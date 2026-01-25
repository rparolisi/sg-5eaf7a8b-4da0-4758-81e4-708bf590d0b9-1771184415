import os
import uvicorn
    from fastapi import FastAPI, HTTPException, Request, Query, Header
from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
    from supabase import create_client, Client
from typing import List, Dict, Optional, Any
import pandas as pd
import numpy as np
import yfinance as yf
from datetime import datetime, timedelta

# -- - CONFIGURAZIONE-- -
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY") # Service Role Key

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Le credenziali Supabase non sono impostate!")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# -- - MODELLI DATI INPUT-- -
    class TransactionInput(BaseModel):
user_id: str
people: List[str]
security: str
date: str
price: str
currency: str # Asset Currency(es.USD)
exchange_rate: str
shares_single: Optional[str] = ""
shares_multi: Optional[Dict[str, str]] = {}
platform: str
account_owner: str
regulated: str
expenses: str
taxes: str
type: str

class PortfolioHistoryInput(BaseModel):
user_id: str
tickers: List[str]
people: Optional[List[str]] = None
categories: Optional[List[str]] = None
start_date: str
end_date: str

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins = ["*"],
    allow_credentials = True,
    allow_methods = ["*"],
    allow_headers = ["*"],
)

# -- - HELPER: RECUPERA VALUTA UTENTE-- -
    def get_user_currency(user_id: str) -> str:
try:
res = supabase.table('users').select('currency').eq('user_id', user_id).single().execute()
if res.data and res.data.get('currency'):
return res.data['currency']
    except Exception as e:
print(f"Warning fetching user currency for {user_id}: {e}")
return 'EUR' # Default

# -- - HELPER: WAC AT DATE-- -
    def get_wac_at_date(all_data: List[dict], target_date_str: str) -> float:
if not all_data: return 0.0
df = pd.DataFrame(all_data)
df['operation_date'] = pd.to_datetime(df['operation_date'])
target_date = pd.to_datetime(target_date_str)

df = df[df['operation_date'] <= target_date].copy()
if df.empty: return 0.0

df = df.sort_values(by = ['operation_date', 'buy_or_sell'], ascending = [True, False])

if 'average_price_user_curr' in df.columns:
    last_row = df.iloc[-1]
val = last_row['average_price_user_curr']
return float(val) if val and not pd.isna(val) else 0.0
return 0.0

# -- - HELPER: RICALCOLO TOTALE STORICO(WAC)-- -
    def recalculate_full_history(all_data: List[dict]) -> List[dict]:
if not all_data: return []

df = pd.DataFrame(all_data)
df['operation_date'] = pd.to_datetime(df['operation_date'])

cols_to_numeric = ['shares_count', 'price_per_share_user_curr', 'effective_price_per_share_user_curr', 'operation_sign', 'buy_or_sell']
for c in cols_to_numeric:
    if c in df.columns: df[c] = pd.to_numeric(df[c], errors = 'coerce').fillna(0)

if 'transaction_id' in df.columns:
    df['transaction_id'] = pd.to_numeric(df['transaction_id'], errors = 'coerce')

df = df.sort_values(by = ['operation_date', 'buy_or_sell'], ascending = [True, False]).reset_index(drop = True)

df['signed_shares'] = df['shares_count'] * df['operation_sign']
df['cumulative_shares_count'] = df['signed_shares'].cumsum()

df['average_price_user_curr'] = 0.0
df['effective_average_price_user_curr'] = 0.0

state = { 'shares': 0.0, 'cost': 0.0, 'eff_cost': 0.0, 'avg': 0.0, 'eff_avg': 0.0 }

for idx, row in df.iterrows():
    qty = row['shares_count']
sign = row['operation_sign']
is_real_transaction = (row['buy_or_sell'] == 1)

if is_real_transaction:
    price_user = row['price_per_share_user_curr']
eff_price_user = row['effective_price_per_share_user_curr']

if sign == 1: # ACQUISTO
new_cost = state['cost'] + (price_user * qty)
new_eff = state['eff_cost'] + (eff_price_user * qty)
new_shares = state['shares'] + qty

state['shares'] = new_shares
state['cost'] = new_cost
state['eff_cost'] = new_eff

if new_shares > 0:
    state['avg'] = new_cost / new_shares
state['eff_avg'] = new_eff / new_shares
                else:
state['avg'] = 0.0; state['eff_avg'] = 0.0
                    
            elif sign == -1: # VENDITA
shares_rm = qty
cost_rm = state['avg'] * shares_rm
eff_rm = state['eff_avg'] * shares_rm

state['shares'] -= shares_rm
state['cost'] -= cost_rm
state['eff_cost'] -= eff_rm

if state['shares'] <= 1e-6:
    state = { 'shares': 0.0, 'cost': 0.0, 'eff_cost': 0.0, 'avg': 0.0, 'eff_avg': 0.0 }

df.at[idx, 'average_price_user_curr'] = state['avg']
df.at[idx, 'effective_average_price_user_curr'] = state['eff_avg']

    # FIFO Date logic
df['historical_fifo_avg_date'] = pd.NaT
inv = []
for idx, row in df.iterrows():
    if row['buy_or_sell'] == 0: continue
sign = row['operation_sign']; qty = round(row['shares_count'], 6); date_op = row['operation_date']

if sign == 1:
    if qty > 0: inv.append({ 'd': date_op, 'q': qty })
        elif sign == -1:
q_sell = qty
while q_sell > 1e-6 and inv:
if inv[0]['q'] > q_sell:
    inv[0]['q'] -= q_sell; q_sell = 0
                else:
q_sell -= inv[0]['q']; inv.pop(0)

rem_qty = sum(i['q'] for i in inv)
    if rem_qty > 1e-6:
        w_sum = sum(i['d'].timestamp() * i['q'] for i in inv)
    df.at[idx, 'historical_fifo_avg_date'] = datetime.fromtimestamp(w_sum / rem_qty)
        else:
df.at[idx, 'historical_fifo_avg_date'] = None

    # Clean
df['historical_fifo_avg_date'] = df['historical_fifo_avg_date'].apply(lambda x: x.isoformat() if pd.notnull(x) else None)
df['operation_date'] = df['operation_date'].apply(lambda x: x.strftime('%Y-%m-%d') if pd.notnull(x) else x)
df = df.replace({ np.nan: None })
if 'signed_shares' in df.columns: df.drop(columns = ['signed_shares'], inplace = True)
return df.to_dict(orient = 'records')

@app.get("/")
def read_root():
return { "status": "active", "message": "Invest API V5.4 (Ticker Auto-Discovery)" }

# -- - PROCESS TRANSACTION-- -
    @app.post("/process_transaction")
    async def process_transaction(data: TransactionInput):
print(f"Processing {data.type}: {data.security} User: {data.user_id}")

try:
try:
res = supabase.table("transactions").select("transaction_id").execute()
curr_max = 0
if res.data:
    ids = [int(r['transaction_id']) for r in res.data if r.get('transaction_id') is not None]
if ids: curr_max = max(ids)
new_id = curr_max + 1
except:
new_id = 1

user_curr = get_user_currency(data.user_id)

price_asset = float(data.price)
exchange_rate = float(data.exchange_rate)

if data.currency == user_curr:
    exchange_rate = 1.0

price_user = price_asset / exchange_rate if exchange_rate != 0 else 0

expenses = float(data.expenses)
taxes = float(data.taxes)

tot_shares = 0.0
shares_map = {}
for p in data.people:
    s = float(data.shares_single) if len(data.people) == 1 else float(data.shares_multi.get(p, 0))
shares_map[p] = s
tot_shares += s

if tot_shares == 0: raise ValueError("Shares cannot be 0")

for p in data.people:
    s_ind = shares_map[p]
if s_ind <= 0: continue

h_res = supabase.table("transactions").select("*").eq("ticker", data.security.upper()).eq("person", p).eq("user_id", data.user_id).execute()
h_data = h_res.data if h_res.data else[]

ratio = s_ind / tot_shares
f_ind = expenses * ratio
t_ind = taxes * ratio

val_base = price_user * s_ind
cost_basis = val_base + f_ind + t_ind
eff_price = cost_basis / s_ind if s_ind > 0 else 0

rows = []
t_type = "Buy" if data.type in ["Acquisto", "Buy"] else "Sell"

base_row = {
    "ticker": data.security.upper(),
    "operation_date": data.date,
    "asset_currency": data.currency,
    "price_per_share_asset_curr": price_asset,
    "user_id": data.user_id,
    "exchange_rate_at_purchase": exchange_rate,
    "total_shares_num": tot_shares,
    "platform": data.platform,
    "account_owner": data.account_owner,
    "regulated_market_or_mtf": data.regulated,
    "transaction_fees_user_curr": f_ind,
    "transaction_taxes_user_curr": t_ind,
    "person": p,
    "shares_count": s_ind,
    "transaction_id": new_id,
    "average_price_user_curr": 0,
    "effective_average_price_user_curr": 0
}

if t_type == "Buy":
    rows.append({
                    ** base_row,
        "category": "Buy",
        "price_per_share_user_curr": price_user,
        "operation_sign": 1,
        "buy_or_sell": 1,
        "total_outlay_user_curr": cost_basis,
        "effective_price_per_share_user_curr": eff_price
                })
            elif t_type == "Sell":
curr_wac = get_wac_at_date(h_data, data.date)
net_proceeds = val_base - f_ind - t_ind

rows.append({
                    ** base_row,
    "category": "Sell",
    "price_per_share_user_curr": price_user,
    "operation_sign": -1,
    "buy_or_sell": 1,
    "total_outlay_user_curr": (price_user * s_ind * -1) + f_ind + t_ind,
    "effective_price_per_share_user_curr": 0
                })

cost_sold = curr_wac * s_ind
pnl = net_proceeds - cost_sold
pnl_cat = "Profit" if pnl >= 0 else "Loss"
pnl_sgn = 1 if pnl >= 0 else -1

rows.append({
                    ** base_row,
    "category": pnl_cat,
    "price_per_share_asset_curr": 0,
    "price_per_share_user_curr": abs(pnl),
    "operation_sign": pnl_sgn,
    "buy_or_sell": 0,
    "total_outlay_user_curr": pnl,
    "effective_price_per_share_user_curr": abs(pnl),
    "shares_count": shares_individual 
                })

if rows:
    supabase.table("transactions").insert(rows).execute()

h_res = supabase.table("transactions").select("*").eq("ticker", data.security.upper()).eq("person", p).eq("user_id", data.user_id).order("operation_date", desc = False).execute()
full_ds = h_res.data if h_res.data else[]
recalc = recalculate_full_history(full_ds)
if recalc: supabase.table("transactions").upsert(recalc).execute()

return { "status": "success", "message": f"ID {new_id}"}
    except Exception as e:
print(f"Error: {e}")
        raise HTTPException(status_code = 500, detail = str(e))

# -- - GET PORTFOLIO(SNAPSHOT)-- -
    @app.get("/api/portfolio")
def get_portfolio(
        user_id: str = Query(..., description = "User ID"),
        target_date: Optional[str] = None,
        people: Optional[List[str]] = Query(None)
    ):
user_curr = get_user_currency(user_id)

try:
        # Filtra per User ID
q = supabase.table('transactions').select("*").eq('user_id', user_id)
res = q.execute()
data = res.data
    except Exception as e:
return { "error": str(e) }, 500

if not data: return []

df = pd.DataFrame(data)
num_map = {
    'shares_count': 'shares_count',
    'average_price_user_curr': 'avg_price',
    'total_outlay_user_curr': 'total_outlay',
    'operation_sign': 'operation_sign',
    'buy_or_sell': 'buy_or_sell'
}
for db_col, df_col in num_map.items():
    if db_col in df.columns:
        df[df_col] = pd.to_numeric(df[db_col], errors = 'coerce').fillna(0)
    else:
    df[df_col] = 0.0

df['ticker'] = df['ticker'].astype(str)
df['operation_date'] = pd.to_datetime(df['operation_date'])

if people: df = df[df['person'].isin(people)]
if df.empty: return []
    
    # Map Tickers & Currencies
u_tickers = df['ticker'].unique().tolist()
t_map = {}
asset_currs = {}

try:
s_res = supabase.table('securities_info').select('ticker, ticker_yfinance, currency').in_('ticker', u_tickers).execute()
if s_res.data:
    for r in s_res.data:
        ti = r['ticker']
ty = r['ticker_yfinance']
tc = r.get('currency', 'EUR')
t_map[ti] = str(ty).strip() if (ty and str(ty).strip()) else ti
asset_currs[ti] = tc
except:
for t in u_tickers: t_map[t] = t; asset_currs[t] = 'EUR'
        
    # Market Data
fetch_list = list(set([v for v in t_map.values() if v]))
    # Forex Pairs
for ti in u_tickers:
    ac = asset_currs.get(ti, user_curr)
if ac != user_curr:
    fetch_list.append(f"{user_curr}{ac}=X")

market_prices = {}
if fetch_list:
    try:
d_start = (datetime.now() - timedelta(days = 7)).strftime('%Y-%m-%d')
if target_date: d_start = (datetime.strptime(target_date, "%Y-%m-%d") - timedelta(days = 7)).strftime('%Y-%m-%d')

m_res = supabase.table('market_data').select('ticker, date, close').in_('ticker', fetch_list).gte('date', d_start).order('date', desc = True).execute()
if m_res.data:
    m_df = pd.DataFrame(m_res.data)
                # Last price
last_p = m_df.sort_values('date').groupby('ticker').tail(1)
market_prices = last_p.set_index('ticker')['close'].to_dict()
        except Exception as e:
print(f"Mkt fetch err: {e}")

portfolio = []

for t in u_tickers:
    yt = t_map.get(t)
ac = asset_currs.get(t, user_curr)
t_trans = df[df['ticker'] == t]

curr_qty = 0.0
curr_cost = 0.0

for _, row in t_trans.iterrows():
    if target_date and row['operation_date'] > pd.to_datetime(target_date): break
qty = row['shares_count']
sign = row['operation_sign']
bs = row['buy_or_sell']
out = row['total_outlay']

if bs == 1:
    if sign == 1:
        curr_qty += qty
curr_cost += out
                elif sign == -1:
if curr_qty > 0:
    avg = curr_cost / curr_qty
curr_qty = max(0, curr_qty - qty)
curr_cost = max(0, curr_cost - (avg * qty))

if curr_qty < 0.001 and len(t_trans) == 0: continue

avg_price = curr_cost / curr_qty if curr_qty > 0 else 0
price_asset = market_prices.get(yt, 0.0)
        
        # FX Logic
if ac == user_curr:
    fx = 1.0
else:
fx_tick = f"{user_curr}{ac}=X"
fx = market_prices.get(fx_tick, 1.0)
if fx == 0: fx = 1.0

price_user = price_asset / fx
is_live = (price_asset > 0)

if price_user == 0:
    price_user = avg_price
is_live = False

mkt_val = price_user * curr_qty
pnl = mkt_val - curr_cost
perf = (pnl / curr_cost * 100) if curr_cost != 0 else 0
last_dt = t_trans['operation_date'].max()

portfolio.append({
    "ticker": t,
    "y_ticker": yt,
    "quantity": round(curr_qty, 2),
    "avg_price": round(avg_price, 2),
    "avg_date": last_dt.strftime('%Y-%m-%d') if last_dt else None,
    "total_exposure": round(curr_cost, 2),
    "current_price": round(price_user, 2),
    "profit_loss": round(pnl, 2),
    "performance_perc": round(perf, 2),
    "total_dividends": 0, # TODO
            "is_live_price": is_live,
    "currency_display": user_curr
})

portfolio.sort(key = lambda x: x['total_exposure'], reverse = True)
return portfolio

# -- - GET HISTORY(PLOT)-- -
    @app.post("/api/portfolio_history")
def get_portfolio_history(payload: PortfolioHistoryInput):
user_curr = get_user_currency(payload.user_id)
print(f"History for {payload.user_id} in {user_curr}")

try:
q = supabase.table('transactions').select("*").eq('user_id', payload.user_id)
if payload.people: q = q.in_('person', payload.people)
q = q.lte('operation_date', payload.end_date).limit(50000)
data = q.execute().data
    except Exception as e:
        raise HTTPException(500, str(e))

if not data: return []

df = pd.DataFrame(data)
df['operation_date'] = pd.to_datetime(df['operation_date'])
df['shares_count'] = pd.to_numeric(df['shares_count']).fillna(0)
df['total_outlay'] = pd.to_numeric(df['total_outlay_user_curr']).fillna(0)
df['operation_sign'] = pd.to_numeric(df['operation_sign']).fillna(0)
df['buy_or_sell'] = pd.to_numeric(df['buy_or_sell']).fillna(0)

if payload.tickers: df = df[df['ticker'].isin(payload.tickers)]
if df.empty: return []
    
    # Maps
u_tick = df['ticker'].unique().tolist()
t_map = {}; a_currs = {}
try:
s_res = supabase.table('securities_info').select('ticker, ticker_yfinance, currency').in_('ticker', u_tick).execute()
for r in s_res.data:
    t = r['ticker']
t_map[t] = r.get('ticker_yfinance') or t
a_currs[t] = r.get('currency', 'EUR')
except:
for t in u_tick: t_map[t] = t; a_currs[t] = 'EUR'
        
    # Fetch History
dates = pd.date_range(start = payload.start_date, end = payload.end_date)
fetch_l = set([t_map[t] for t in u_tick])
forex_l = set()
for t in u_tick:
    ac = a_currs.get(t, user_curr)
if ac != user_curr:
    forex_l.add(f"{user_curr}{ac}=X")

all_fetch = list(fetch_l.union(forex_l))
mkt_df = pd.DataFrame(index = dates)
fx_df = pd.DataFrame(index = dates)

if all_fetch:
    try:
d_start = (pd.to_datetime(payload.start_date) - timedelta(days = 10)).strftime('%Y-%m-%d')
res = supabase.table('market_data').select('ticker, date, close').in_('ticker', all_fetch).gte('date', d_start).lte('date', payload.end_date).execute()
if res.data:
    raw = pd.DataFrame(res.data)
raw['date'] = pd.to_datetime(raw['date'])
raw['close'] = pd.to_numeric(raw['close'])
piv = raw.pivot(index = 'date', columns = 'ticker', values = 'close')
piv = piv.groupby(level = 0).last().reindex(dates).ffill()

for c in piv.columns:
    if c in forex_l: fx_df[c] = piv[c].fillna(1.0)
    else: mkt_df[c] = piv[c]
        except Exception as e:
print(f"Hist err: {e}")
            
    # Reconstruct
df = df.sort_values(['operation_date', 'transaction_id'])

curr_s = { t: 0.0 for t in u_tick }
curr_c = { t: 0.0 for t in u_tick }
    
    # Pre - period
pre = df[df['operation_date'] < dates[0]]
in_p = df[df['operation_date'] >= dates[0]]

for _, row in pre.iterrows():
    t = row['ticker']; qty = row['shares_count']; sgn = row['operation_sign']; out = row['total_outlay']
if row['buy_or_sell'] == 1:
    if sgn == 1:
        curr_s[t] += qty; curr_c[t] += out
            elif sgn == -1:
if curr_s[t] > 0:
    avg = curr_c[t] / curr_s[t]
curr_c[t] = max(0, curr_c[t] - avg * qty)
curr_s[t] = max(0, curr_s[t] - qty)
                    
    # In - period
gr = in_p.groupby('operation_date')
shares_dict = {}; cost_dict = {}

for d in dates:
    if d in gr.groups:
        for _, row in gr.get_group(d).iterrows():
            t = row['ticker']; qty = row['shares_count']; sgn = row['operation_sign']; out = row['total_outlay']
if row['buy_or_sell'] == 1:
    if sgn == 1:
        curr_s[t] += qty; curr_c[t] += out
                    elif sgn == -1:
if curr_s[t] > 0:
    avg = curr_c[t] / curr_s[t]
curr_c[t] = max(0, curr_c[t] - avg * qty)
curr_s[t] = max(0, curr_s[t] - qty)
shares_dict[d] = curr_s.copy()
cost_dict[d] = curr_c.copy()

ds = pd.DataFrame.from_dict(shares_dict, orient = 'index')
dc = pd.DataFrame.from_dict(cost_dict, orient = 'index')

tot_val = pd.Series(0.0, index = dates)

for t in u_tick:
    yt = t_map[t]
ac = a_currs.get(t, user_curr)

if t in ds.columns:
    qs = ds[t]
cs = dc[t]
ps = mkt_df[yt] if yt in mkt_df.columns else pd.Series(np.nan, index = dates)

if ac == user_curr: fx = 1.0
else:
ft = f"{user_curr}{ac}=X"
fx = fx_df[ft] if ft in fx_df.columns else 1.0

p_user = ps / fx
val = qs * p_user
            
            # Fallback
mask = (p_user.isna()) | (p_user == 0)
fin = val.where(~mask, cs).fillna(0)
tot_val += fin

tot_exp = dc.sum(axis = 1)

res = []
for d in dates:
    exp = tot_exp.loc[d]
mkt = tot_val.loc[d]
res.append({
    "date": d.strftime('%Y-%m-%d'),
    "exposure": round(exp, 2),
    "market_value": round(mkt, 2),
    "profit_loss": round(mkt - exp, 2),
    "dividends": 0
})

return res

# -- - CRON JOB-- -
    @app.get("/api/cron/update_market_data")
def update_market_data_daily(authorization: str = Header(None)):
sec = os.environ.get("CRON_SECRET")
if sec and authorization != f"Bearer {sec}": raise HTTPException(401, "Auth failed")

print("⏰ Cron Update...")
t_map = {}
try:
r = supabase.table('securities_info').select('ticker, ticker_yfinance, currency').execute()
if r.data:
    for row in r.data:
        eff = str(row['ticker_yfinance']).strip() if row['ticker_yfinance'] else row['ticker']
t_map[eff] = row['currency']
except: return { "err": "DB Error" }
    
    # 1. Recupera Ticker anche dalle Transazioni(FIX "0 Updates")
try:
trans_r = supabase.table('transactions').select('ticker').execute()
if trans_r.data:
    trans_tickers = set([r['ticker'] for r in trans_r.data])
for t in trans_tickers:
    if t not in t_map:
t_map[t] = 'N/A' # Default
    except Exception as e: print(f"Trans tickers fetch err: {e}")

u_ticks = list(t_map.keys())
maj = ['USD', 'EUR', 'GBP', 'CHF']
for b in maj:
    for q in maj:
        if b != q: u_ticks.append(f"{b}{q}=X")

cnt = 0
for t in set(u_ticks):
    try:
last = supabase.table('market_data').select('date').eq('ticker', t).order('date', desc = True).limit(1).execute()
s_dt = datetime.now() - timedelta(days = 5 * 365)
if last.data:
    s_dt = datetime.strptime(last.data[0]['date'], '%Y-%m-%d') + timedelta(days = 1)

if s_dt >= datetime.now() + timedelta(days = 1): continue

print(f"Upd {t}")
dat = yf.Ticker(t).history(start = s_dt.strftime('%Y-%m-%d'), auto_adjust = True)
if dat.empty: continue

recs = []
cur = t_map.get(t, 'FOREX' if '=X' in t else 'N/A')

for idx, row in dat.iterrows():
    recs.append({
        "ticker": t,
        "date": idx.strftime('%Y-%m-%d'),
        "close": round(float(row['Close']), 4),
        "dividend": round(float(row.get('Dividends', 0)), 4),
        "currency": cur
    })
if recs:
    supabase.table('market_data').upsert(recs, on_conflict = 'ticker, date').execute()
cnt += 1
except: pass

return { "status": "ok", "updated": cnt }

if __name__ == '__main__':
    uvicorn.run(app, host = "0.0.0.0", port = 8000)