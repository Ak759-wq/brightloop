#!/usr/bin/env bash
# End-to-end API smoke test against a running server in LOCAL auth mode.
# Usage: BASE=http://localhost:3005 CRON_SECRET=testsecret bash scripts/smoke.sh
set -u
B=${BASE:-http://localhost:3005}
pass=0; fail=0
ok() { echo "PASS  $1"; pass=$((pass+1)); }
ko() { echo "FAIL  $1 :: $2"; fail=$((fail+1)); }
j() { python3 -c "import sys,json; d=json.load(sys.stdin); print(eval(sys.argv[1]))" "$1"; }
login() { curl -s $B/api/auth/local/login -H 'content-type: application/json' -d "{\"email\":\"$1\",\"password\":\"$2\"}" | j "d.get('token','')"; }
TA=$(login admin@brightloop.demo 'Admin@12345'); TS=$(login staff@brightloop.demo 'Staff@12345'); TC=$(login customer@brightloop.demo 'Customer@123')
[ -n "$TA" ] && ok "admin login" || ko "admin login" "no token"
[ -n "$TS" ] && ok "staff login" || ko "staff login" "no token"
[ -n "$TC" ] && ok "customer login" || ko "customer login" "no token"
A=(-H "authorization: Bearer $TA" -H 'content-type: application/json')
S=(-H "authorization: Bearer $TS" -H 'content-type: application/json')
C=(-H "authorization: Bearer $TC" -H 'content-type: application/json')

r=$(curl -s $B/api/auth/local/login -H 'content-type: application/json' -d '{"email":"admin@brightloop.demo","password":"wrong"}'); echo "$r" | grep -q Incorrect && ok "wrong password rejected" || ko "wrong password" "$r"
r=$(curl -s $B/api/auth/local/register -H 'content-type: application/json' -d '{"name":"Weak","email":"weak@x.example","password":"short"}'); echo "$r" | grep -q "more than 8" && ok "weak password rejected server-side" || ko "weak pw" "$r"
r=$(curl -s $B/api/auth/local/register -H 'content-type: application/json' -d '{"name":"Dup","email":"admin@brightloop.demo","password":"Abcdefgh@1"}'); echo "$r" | grep -q "already exists" && ok "duplicate email rejected" || ko "dup email" "$r"
NEWT=$(curl -s $B/api/auth/local/register -H 'content-type: application/json' -d "{\"name\":\"New Person\",\"email\":\"new$RANDOM@x.example\",\"password\":\"Abcdefgh@1\",\"placeOfSupply\":\"27\"}" | j "d.get('token','')")
[ -n "$NEWT" ] && ok "self-registration creates customer account" || ko "register" "no token"
r=$(curl -s $B/api/me -H "authorization: Bearer $NEWT" | j "d['session']['role']"); [ "$r" = customer ] && ok "new account role = customer" || ko "role" "$r"

r=$(curl -s "$B/api/r/products?limit=5" "${S[@]}" | j "'costPrice' in d['items'][0]"); [ "$r" = False ] && ok "staff cannot see cost price" || ko "cost price" "$r"
r=$(curl -s "$B/api/r/products?limit=5" "${A[@]}" | j "'costPrice' in d['items'][0]"); [ "$r" = True ] && ok "admin sees cost price" || ko "admin cost" "$r"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/api/r/tax_rules" "${S[@]}" -d '{"name":"X","rateBp":100}'); [ "$code" = 403 ] && ok "staff cannot write taxes" || ko "staff tax" "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/api/r/discounts" "${S[@]}" -d '{"name":"X","type":"fixed","value":100,"scope":"subscription"}'); [ "$code" = 403 ] && ok "staff cannot create discounts" || ko "staff disc" "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/api/admin/staff" "${S[@]}" -d '{"name":"X Y","email":"x@y.example","password":"Abcdefgh@1"}'); [ "$code" = 403 ] && ok "staff cannot create staff" || ko "staff staff" "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' "$B/api/r/audit_logs" "${S[@]}"); [ "$code" = 403 ] && ok "staff cannot read audit logs" || ko "staff audit" "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$B/api/settings" "${S[@]}" -d '{"paymentTermsDays":5}'); [ "$code" = 403 ] && ok "staff cannot change settings" || ko "staff settings" "$code"
r=$(curl -s "$B/api/r/invoices?limit=100" "${C[@]}" | j "sorted(set(i['customerId'] for i in d['items']))"); [ "$r" = "['cust_001']" ] && ok "customer sees only own invoices" || ko "customer scope" "$r"
code=$(curl -s -o /dev/null -w '%{http_code}' "$B/api/r/customers/cust_002" "${C[@]}"); [ "$code" = 404 ] && ok "customer cannot read another customer" || ko "cust other" "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' "$B/api/analytics" "${C[@]}"); [ "$code" = 403 ] && ok "customer cannot read analytics" || ko "cust analytics" "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/api/payments" "${C[@]}" -d '{"invoiceId":"x","method":"cash","amount":100,"date":"2026-10-31"}'); [ "$code" = 403 ] && ok "customer cannot record manual payments" || ko "cust pay" "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' "$B/api/r/customers"); [ "$code" = 401 ] && ok "unauthenticated request rejected" || ko "unauth" "$code"

# product + plan + customer + subscription flow
P=$(curl -s -X POST "$B/api/r/products" "${A[@]}" -d '{"name":"Smoke CRM","type":"software","salesPrice":100000,"costPrice":30000,"taxRuleId":"tax_gst18"}' | j "d['id']")
V=$(curl -s -X POST "$B/api/r/product_variants" "${A[@]}" -d "{\"productId\":\"$P\",\"attribute\":\"Brand\",\"value\":\"Odoo\",\"priceDelta\":56000}" | j "d['id']")
AD=$(curl -s -X POST "$B/api/r/product_addons" "${A[@]}" -d "{\"productId\":\"$P\",\"name\":\"Premium support\",\"price\":30000}" | j "d['id']")
PL=$(curl -s -X POST "$B/api/r/plans" "${A[@]}" -d "{\"name\":\"Smoke Monthly\",\"productId\":\"$P\",\"pricingModel\":\"per_seat\",\"price\":100000,\"interval\":\"monthly\",\"minQuantity\":2}" | j "d['id']")
[ -n "$PL" ] && ok "admin creates product, variant, add-on, plan" || ko "catalog" "$P $V $AD $PL"
CU=$(curl -s -X POST "$B/api/r/customers" "${S[@]}" -d "{\"name\":\"Smoke Traders $RANDOM\",\"email\":\"smoke$RANDOM@x.example\",\"placeOfSupply\":\"27\"}" | j "d['id']")
[ -n "$CU" ] && ok "staff creates customer" || ko "customer" "$CU"
r=$(curl -s -X POST "$B/api/pricing/preview" "${S[@]}" -d "{\"planId\":\"$PL\",\"customerId\":\"$CU\",\"items\":[{\"productId\":\"$P\",\"variantIds\":[\"$V\"],\"addonIds\":[\"$AD\"],\"quantity\":2}]}" | j "(d['items'][0]['unitPrice'], d['preview']['totals']['igst'], d['preview']['totals']['total'])")
[ "$r" = "(186000, 66960, 438960)" ] && ok "preview: 1000+560+300=1860/seat ×2, IGST 18% (KA→MH) = 4389.60" || ko "preview" "$r"
r=$(curl -s -X POST "$B/api/subscriptions" "${S[@]}" -d "{\"customerId\":\"$CU\",\"planId\":\"$PL\",\"items\":[{\"productId\":\"$P\",\"variantIds\":[],\"addonIds\":[],\"quantity\":1}],\"status\":\"draft\"}"); echo "$r" | grep -q "Minimum quantity" && ok "minimum quantity enforced" || ko "min qty" "$r"
SUB=$(curl -s -X POST "$B/api/subscriptions" "${S[@]}" -d "{\"customerId\":\"$CU\",\"planId\":\"$PL\",\"items\":[{\"productId\":\"$P\",\"variantIds\":[\"$V\"],\"addonIds\":[\"$AD\"],\"quantity\":2}],\"status\":\"quotation\",\"discountIds\":[\"disc_welcome10\"]}" | j "d['id']")
[ -n "$SUB" ] && ok "quotation created" || ko "sub" "$SUB"
for a in confirm activate; do r=$(curl -s -X POST "$B/api/subscriptions/$SUB/action" "${S[@]}" -d "{\"action\":\"$a\"}" | j "d['status']"); [ "$r" = "$( [ $a = confirm ] && echo confirmed || echo active)" ] && ok "transition $a" || ko "transition $a" "$r"; done
INV=$(curl -s "$B/api/r/invoices?subscriptionId=$SUB" "${A[@]}" | j "d['items'][0]['id']")
r=$(curl -s "$B/api/r/invoices/$INV" "${A[@]}" | j "(d['status'], d['totals']['subtotal'], d['totals']['discountTotal'], d['totals']['igst'], d['total'])")
[ "$r" = "('confirmed', 372000, 37200, 60264, 395064)" ] && ok "first invoice on activation: 3720 − 10% + IGST = 3950.64" || ko "first invoice" "$r"
B1=$(curl -s -X POST "$B/api/billing/run" -H "x-cron-secret: ${CRON_SECRET:-testsecret}" | j "d['invoicesCreated']")
B2=$(curl -s -X POST "$B/api/billing/run" -H "x-cron-secret: ${CRON_SECRET:-testsecret}" | j "d['invoicesCreated']")
[ "$B1" = 0 ] && [ "$B2" = 0 ] && ok "billing re-run creates no duplicates" || ko "billing rerun" "$B1 $B2"
r=$(curl -s -X POST "$B/api/payments" "${S[@]}" -d "{\"invoiceId\":\"$INV\",\"method\":\"upi\",\"amount\":100000,\"date\":\"2026-10-31\",\"note\":\"part\"}" | j "d['invoice']['status']"); [ "$r" = partially_paid ] && ok "partial payment → partially_paid" || ko "partial" "$r"
r=$(curl -s -X POST "$B/api/payments" "${S[@]}" -d "{\"invoiceId\":\"$INV\",\"method\":\"upi\",\"amount\":999999999,\"date\":\"2026-10-31\"}"); echo "$r" | grep -q exceeds && ok "overpayment rejected" || ko "overpay" "$r"
r=$(curl -s -X POST "$B/api/payments/simulate" "${S[@]}" -d "{\"invoiceId\":\"$INV\",\"outcome\":\"fail\",\"reason\":\"Insufficient funds\"}" | j "(d['outcome'], d['nextRetryOn'] is not None)"); [ "$r" = "('fail', True)" ] && ok "simulated failure schedules retry" || ko "sim fail" "$r"
r=$(curl -s "$B/api/r/invoices/$INV" "${A[@]}" | j "d['status']"); [ "$r" = partially_paid ] && ok "failed payment did not mark paid" || ko "fail status" "$r"
r=$(curl -s -X POST "$B/api/payments/simulate" "${S[@]}" -d "{\"invoiceId\":\"$INV\",\"outcome\":\"success\"}" | j "d['invoice']['status']"); [ "$r" = paid ] && ok "simulated success → paid" || ko "sim success" "$r"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/api/invoices/$INV/action" "${S[@]}" -d '{"action":"cancel","reason":"x"}'); [ "$code" = 422 ] && ok "cannot cancel invoice with payments" || ko "cancel paid" "$code"
r=$(curl -s -X POST "$B/api/subscriptions/$SUB/change" "${S[@]}" -d "{\"items\":[{\"productId\":\"$P\",\"variantIds\":[\"$V\"],\"addonIds\":[\"$AD\"],\"quantity\":4}]}" | j "d['proration'] is not None")
[ "$r" = True ] && ok "upgrade computes proration" || ko "upgrade" "$r"
r=$(curl -s -X POST "$B/api/subscriptions/$SUB/action" "${S[@]}" -d '{"action":"pause"}' | j "d['status']"); [ "$r" = paused ] && ok "pause" || ko "pause" "$r"
r=$(curl -s -X POST "$B/api/subscriptions/$SUB/action" "${S[@]}" -d '{"action":"resume"}' | j "d['status']"); [ "$r" = active ] && ok "resume" || ko "resume" "$r"
r=$(curl -s -X POST "$B/api/subscriptions/$SUB/action" "${S[@]}" -d '{"action":"close"}'); echo "$r" | grep -q reason && ok "cancel requires reason" || ko "close reason" "$r"
r=$(curl -s -X POST "$B/api/subscriptions/$SUB/action" "${S[@]}" -d '{"action":"close","reason":"Switching provider"}' | j "d['status']"); [ "$r" = closed ] && ok "cancel with reason" || ko "close" "$r"
r=$(curl -s "$B/api/r/subscription_versions?subscriptionId=$SUB&limit=50" "${A[@]}" | j "len(d['items'])"); [ "$r" -ge 6 ] && ok "version history recorded ($r versions)" || ko "versions" "$r"

# customer self-service
CS=$(curl -s -X POST "$B/api/portal/subscribe" "${C[@]}" -d '{"planId":"plan_books_m","quantity":1,"code":"WELCOME10"}' | j "d['status']"); [ "$CS" = active ] && ok "customer self-subscribes with code" || ko "self-subscribe" "$CS"
CI=$(curl -s "$B/api/r/invoices?status=__in_open&limit=1" "${C[@]}" | j "d['items'][0]['id']")
r=$(curl -s -X POST "$B/api/payments/simulate" "${C[@]}" -d "{\"invoiceId\":\"$CI\",\"outcome\":\"success\"}" | j "d['invoice']['status']"); [ "$r" = paid ] && ok "customer pays own invoice (simulator)" || ko "cust pay" "$r"
OTHER=$(curl -s "$B/api/r/invoices?customerId=cust_005&status=__in_open&limit=1" "${A[@]}" | j "d['items'][0]['id']")
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/api/payments/simulate" "${C[@]}" -d "{\"invoiceId\":\"$OTHER\",\"outcome\":\"success\"}"); [ "$code" = 404 ] && ok "customer cannot pay someone else's invoice" || ko "cust other pay" "$code"
r=$(curl -s -X POST "$B/api/assistant" "${A[@]}" -d '{"question":"Which invoices are overdue?"}' | j "d['tool']"); [ "$r" = overdue_invoices ] && ok "assistant routes to overdue tool" || ko "assistant" "$r"
r=$(curl -s -X POST "$B/api/assistant" "${C[@]}" -d '{"question":"what is our MRR"}' | j "d['tool']"); [ "$r" = help ] && ok "assistant refuses company data to customers" || ko "assistant cust" "$r"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/api/payments/razorpay/webhook" -H 'x-razorpay-signature: bad' -d '{}'); [ "$code" = 401 ] && ok "razorpay webhook rejects bad signature" || ko "webhook" "$code"
t0=$(date +%s%N); curl -s "$B/api/r/subscriptions?limit=20&status=active" "${A[@]}" > /dev/null; t1=$(date +%s%N); ms=$(( (t1-t0)/1000000 )); [ $ms -lt 2000 ] && ok "subscription list in ${ms} ms (<2 s)" || ko "perf" "$ms"
echo "---- $pass passed, $fail failed"
[ $fail -eq 0 ]
