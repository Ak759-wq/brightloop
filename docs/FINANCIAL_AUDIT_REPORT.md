# Financial Audit Report

Generated 2026-10-31T04:51:01.564Z from `vitest run` (tests in `tests/finance`, engine in `src/lib/finance`).

**108 / 108 finance cases passed** ✅

All amounts are integer paise (₹1 = 100). Percentages are basis points (18% = 1800). `{ error }` means the engine correctly rejected the input with that message.

Rounding rules verified here: half-up per line and per tax component; totals are sums of rounded lines; splits use largest-remainder so parts always sum to the whole.

## Money & pricing

| ID | Case | Input | Expected | Actual | Result |
|---|---|---|---|---|---|
| M-01 | round half-up 2.5 → 3 | `2.5` | `3` | `3` | ✅ Pass |
| M-02 | round half-up −2.5 → −3 (away from zero) | `-2.5` | `-3` | `-3` | ✅ Pass |
| M-03 | float artefact 1.005 rupees → 101 paise | `1.005` | `101` | `101` | ✅ Pass |
| M-04 | 18% of ₹999.99 | `{"amount":99999,"bp":1800}` | `18000` | `18000` | ✅ Pass |
| M-05 | allocate ₹100 across 3 equal lines sums exactly | `{"total":10000,"weights":[1,1,1]}` | `[3334,3333,3333]` | `[3334,3333,3333]` | ✅ Pass |
| M-06 | allocate with zero weights puts all on first | `{"total":500,"weights":[0,0]}` | `[500,0]` | `[500,0]` | ✅ Pass |
| M-07 | non-integer paise rejected | `10.5` | `{"error":"total must be an integer number of minor units, got 10.5"}` | `{"error":"total must be an integer number of minor units, got 10.5"}` | ✅ Pass |
| P-01 | variant + add-on unit price: CRM ₹1,000 + Odoo ₹560 + Premium support ₹300 | `{"base":100000,"variantDeltas":[56000],"addons":[30000]}` | `186000` | `186000` | ✅ Pass |
| P-02 | per-seat ₹1,860 × 5 seats | `{"model":"per_seat","unitAmount":186000,"quantity":5}` | `930000` | `930000` | ✅ Pass |
| P-03 | flat price ignores quantity | `{"model":"flat","unitAmount":499900,"quantity":20}` | `499900` | `499900` | ✅ Pass |
| P-04 | tiered (graduated) 60 units: 10×100 + 40×80 + 10×60 | `{"model":"tiered","quantity":60,"tiers":[{"upTo":10,"unitAmount":10000},{"upTo":50,"unitAmount":8000},{"upTo":null,"unitAmount":6000}]}` | `480000` | `480000` | ✅ Pass |
| P-05 | volume 60 units all at ₹60 | `{"model":"volume","quantity":60,"tiers":[{"upTo":10,"unitAmount":10000},{"upTo":50,"unitAmount":8000},{"upTo":null,"unitAmount":6000}]}` | `360000` | `360000` | ✅ Pass |
| P-06 | volume boundary 10 units stays in tier 1 | `{"model":"volume","quantity":10,"tiers":[{"upTo":10,"unitAmount":10000},{"upTo":50,"unitAmount":8000},{"upTo":null,"unitAmount":6000}]}` | `100000` | `100000` | ✅ Pass |
| P-07 | tiered boundary 11 units crosses into tier 2 | `{"model":"tiered","quantity":11,"tiers":[{"upTo":10,"unitAmount":10000},{"upTo":50,"unitAmount":8000},{"upTo":null,"unitAmount":6000}]}` | `108000` | `108000` | ✅ Pass |
| P-08 | below plan minimum quantity is rejected | `{"quantity":2,"minQuantity":3}` | `{"error":"Minimum quantity for this plan is 3"}` | `{"error":"Minimum quantity for this plan is 3"}` | ✅ Pass |
| P-09 | fractional quantity rejected | `{"quantity":1.5}` | `{"error":"Quantity must be a whole number of at least 1"}` | `{"error":"Quantity must be a whole number of at least 1"}` | ✅ Pass |
| P-10 | tiered with variant extra per unit | `{"quantity":5,"tiers":[{"upTo":10,"unitAmount":10000},{"upTo":50,"unitAmount":8000},{"upTo":null,"unitAmount":6000}],"perUnitExtra":56000}` | `330000` | `330000` | ✅ Pass |
| P-11 | invalid tiers (last bounded) rejected | `{"tiers":[{"upTo":5,"unitAmount":1}]}` | `{"error":"Last tier must be unbounded (upTo: null)"}` | `{"error":"Last tier must be unbounded (upTo: null)"}` | ✅ Pass |
| P-12 | negative unit price rejected | `{"base":1000,"variantDeltas":[-2000]}` | `{"error":"Unit price cannot be negative"}` | `{"error":"Unit price cannot be negative"}` | ✅ Pass |

## Billing periods & calendars

| ID | Case | Input | Expected | Actual | Result |
|---|---|---|---|---|---|
| D-01 | monthly anchored Jan 31 → Feb 28 (non-leap) | `{"anchor":"2027-01-31","n":1}` | `2027-02-28` | `2027-02-28` | ✅ Pass |
| D-02 | monthly anchored Jan 31 → Feb 29 (leap 2028) | `{"anchor":"2028-01-31","n":1}` | `2028-02-29` | `2028-02-29` | ✅ Pass |
| D-03 | Feb 28 restores to Mar 31 for Jan 31 anchor | `{"anchor":"2027-01-31","current":"2027-02-28"}` | `2027-03-31` | `2027-03-31` | ✅ Pass |
| D-04 | Mar 31 → Apr 30 | `{"anchor":"2027-01-31","current":"2027-03-31"}` | `2027-04-30` | `2027-04-30` | ✅ Pass |
| D-05 | 12 consecutive monthly starts from Jan 31 | `{"anchor":"2026-01-31"}` | `["2026-01-31","2026-02-28","2026-03-31","2026-04-30","2026-05-31","2026-06-30","2026-07-31","2026-08-31","2026-09-30","2026-10-31","2026-11-30","2026-12-31"]` | `["2026-01-31","2026-02-28","2026-03-31","2026-04-30","2026-05-31","2026-06-30","2026-07-31","2026-08-31","2026-09-30","2026-10-31","2026-11-30","2026-12-31"]` | ✅ Pass |
| D-06 | yearly from leap day Feb 29 2028 → Feb 28 2029 | `{"anchor":"2028-02-29"}` | `2029-02-28` | `2029-02-28` | ✅ Pass |
| D-07 | yearly leap anchor returns to Feb 29 in 2032 | `{"anchor":"2028-02-29","n":4}` | `2032-02-29` | `2032-02-29` | ✅ Pass |
| D-08 | weekly period crosses year end | `{"anchor":"2026-12-29"}` | `2027-01-05` | `2027-01-05` | ✅ Pass |
| D-09 | daily period | `{"anchor":"2026-10-31"}` | `2026-11-01` | `2026-11-01` | ✅ Pass |
| D-10 | quarterly (every 3 months) from Nov 30 | `{"anchor":"2026-11-30"}` | `2027-02-28` | `2027-02-28` | ✅ Pass |
| D-11 | period object for Feb 2028 (leap) has 29 days | `{"anchor":"2028-02-01"}` | `{"start":"2028-02-01","endExclusive":"2028-03-01","end":"2028-02-29","days":29}` | `{"start":"2028-02-01","endExclusive":"2028-03-01","end":"2028-02-29","days":29}` | ✅ Pass |
| D-12 | leap year rules 1900/2000/2024/2026 | `[1900,2000,2024,2026]` | `[false,true,true,false]` | `[false,true,true,false]` | ✅ Pass |
| D-13 | addMonthsAnchored negative months | `{"iso":"2027-03-31","months":-1}` | `2027-02-28` | `2027-02-28` | ✅ Pass |
| D-14 | invalid date rejected | `2027-02-30` | `{"error":"Invalid ISO date: 2027-02-30"}` | `{"error":"Invalid ISO date: 2027-02-30"}` | ✅ Pass |

## Proration & discounts

| ID | Case | Input | Expected | Actual | Result |
|---|---|---|---|---|---|
| C-01 | 10% subscription-wide on ₹9,600 | `{"rule":{"id":"d1","name":"10% off","type":"percent","value":1000,"scope":"subscription"},"lines":[{"productId":"crm","quantity":5,"amount":930000},{"productId":"support","quantity":1,"amount":30000}]}` | `{"applicable":true,"amount":96000,"perLine":[93000,3000]}` | `{"applicable":true,"amount":96000,"perLine":[93000,3000]}` | ✅ Pass |
| C-02 | fixed ₹500 product-specific to CRM only | `{"type":"fixed","value":50000,"productIds":["crm"]}` | `{"applicable":true,"amount":50000,"perLine":[50000,0]}` | `{"applicable":true,"amount":50000,"perLine":[50000,0]}` | ✅ Pass |
| C-03 | fixed discount capped at eligible base | `{"value":5000000,"productIds":["support"]}` | `{"applicable":true,"amount":30000,"perLine":[0,30000]}` | `{"applicable":true,"amount":30000,"perLine":[0,30000]}` | ✅ Pass |
| C-04 | minimum quantity not met | `{"minQuantity":10}` | `{"applicable":false,"reason":"Requires at least 10 units","amount":0,"perLine":[0,0]}` | `{"applicable":false,"reason":"Requires at least 10 units","amount":0,"perLine":[0,0]}` | ✅ Pass |
| C-05 | minimum amount not met | `{"minAmount":1000000}` | `{"applicable":false,"reason":"Minimum purchase amount not met","amount":0,"perLine":[0,0]}` | `{"applicable":false,"reason":"Minimum purchase amount not met","amount":0,"perLine":[0,0]}` | ✅ Pass |
| C-06 | expired discount stops applying | `{"endDate":"2026-10-31","date":"2026-11-01"}` | `{"applicable":false,"reason":"Discount has expired","amount":0,"perLine":[0,0]}` | `{"applicable":false,"reason":"Discount has expired","amount":0,"perLine":[0,0]}` | ✅ Pass |
| C-07 | not started yet | `{"startDate":"2026-12-01"}` | `{"applicable":false,"reason":"Discount has not started yet","amount":0,"perLine":[0,0]}` | `{"applicable":false,"reason":"Discount has not started yet","amount":0,"perLine":[0,0]}` | ✅ Pass |
| C-08 | usage limit reached blocks new redemption | `{"usageLimit":5,"usedCount":5}` | `{"applicable":false,"reason":"Discount usage limit reached","amount":0,"perLine":[0,0]}` | `{"applicable":false,"reason":"Discount usage limit reached","amount":0,"perLine":[0,0]}` | ✅ Pass |
| C-09 | already-redeemed subscription keeps discount on renewal despite limit | `{"usageLimit":5,"usedCount":5,"alreadyRedeemed":true}` | `{"applicable":true,"amount":96000,"perLine":[93000,3000]}` | `{"applicable":true,"amount":96000,"perLine":[93000,3000]}` | ✅ Pass |
| C-10 | stacked: 10% then fixed ₹100 on remainder | `{"rules":["10%","₹100"]}` | `{"perLine":[102688,3312],"total":106000}` | `{"perLine":[102688,3312],"total":106000}` | ✅ Pass |
| C-11 | invalid percent >100% rejected by validator | `{"value":12000}` | `["Percentage must be between 0.01% and 100%"]` | `["Percentage must be between 0.01% and 100%"]` | ✅ Pass |
| C-12 | product discount without products rejected | `{"scope":"product"}` | `["Product-specific discounts need at least one product"]` | `["Product-specific discounts need at least one product"]` | ✅ Pass |
| R-01 | upgrade mid-cycle: ₹1,000 → ₹1,860, 15 of 30 days left | `{"periodStart":"2026-11-01","periodEndExclusive":"2026-12-01","changeDate":"2026-11-16","oldAmount":100000,"newAmount":186000}` | `{"totalDays":30,"remainingDays":15,"credit":50000,"charge":93000,"net":43000,"kind":"upgrade"}` | `{"totalDays":30,"remainingDays":15,"credit":50000,"charge":93000,"net":43000,"kind":"upgrade"}` | ✅ Pass |
| R-02 | downgrade gives credit (negative net) | `{"periodStart":"2026-11-01","periodEndExclusive":"2026-12-01","changeDate":"2026-11-21","oldAmount":186000,"newAmount":100000}` | `{"totalDays":30,"remainingDays":10,"credit":62000,"charge":33333,"net":-28667,"kind":"downgrade"}` | `{"totalDays":30,"remainingDays":10,"credit":62000,"charge":33333,"net":-28667,"kind":"downgrade"}` | ✅ Pass |
| R-03 | change on first day = full swap | `{"changeDate":"2026-11-01"}` | `{"totalDays":30,"remainingDays":30,"credit":100000,"charge":186000,"net":86000,"kind":"upgrade"}` | `{"totalDays":30,"remainingDays":30,"credit":100000,"charge":186000,"net":86000,"kind":"upgrade"}` | ✅ Pass |
| R-04 | February leap month uses 29 days | `{"periodStart":"2028-02-01","changeDate":"2028-02-15"}` | `{"totalDays":29,"remainingDays":15,"credit":51724,"charge":103448,"net":51724,"kind":"upgrade"}` | `{"totalDays":29,"remainingDays":15,"credit":51724,"charge":103448,"net":51724,"kind":"upgrade"}` | ✅ Pass |
| R-05 | change outside period rejected | `{"changeDate":"2026-12-05"}` | `{"error":"Change date must fall within the current billing period"}` | `{"error":"Change date must fall within the current billing period"}` | ✅ Pass |

## GST & invoice totals

| ID | Case | Input | Expected | Actual | Result |
|---|---|---|---|---|---|
| I-01 | intra-state invoice with 10% discount | `{"lines":[{"productId":"crm","description":"Brightloop CRM (Odoo) ×5","quantity":5,"unitPrice":186000,"amount":930000,"discount":93000,"taxRule":{"id":"t18","name":"GST 18%","rateBp":1800,"kind":"GST"}},{"productId":"support","description":"Premium support","q` | `{"subtotal":960000,"discountTotal":96000,"taxableTotal":864000,"cgst":77760,"sgst":77760,"igst":0,"taxTotal":155520,"total":1019520}` | `{"subtotal":960000,"discountTotal":96000,"taxableTotal":864000,"cgst":77760,"sgst":77760,"igst":0,"taxTotal":155520,"total":1019520}` | ✅ Pass |
| I-02 | inter-state same lines → IGST only, same total | `{"lines":[{"productId":"crm","description":"Brightloop CRM (Odoo) ×5","quantity":5,"unitPrice":186000,"amount":930000,"discount":93000,"taxRule":{"id":"t18","name":"GST 18%","rateBp":1800,"kind":"GST"}},{"productId":"support","description":"Premium support","q` | `{"subtotal":960000,"discountTotal":96000,"taxableTotal":864000,"cgst":0,"sgst":0,"igst":155520,"taxTotal":155520,"total":1019520}` | `{"subtotal":960000,"discountTotal":96000,"taxableTotal":864000,"cgst":0,"sgst":0,"igst":155520,"taxTotal":155520,"total":1019520}` | ✅ Pass |
| I-03 | line total = taxable + tax for every snapshot line | `{"lines":[{"productId":"crm","description":"Brightloop CRM (Odoo) ×5","quantity":5,"unitPrice":186000,"amount":930000,"discount":93000,"taxRule":{"id":"t18","name":"GST 18%","rateBp":1800,"kind":"GST"}},{"productId":"support","description":"Premium support","q` | `[true,true]` | `[true,true]` | ✅ Pass |
| I-04 | discount larger than line rejected | `{"amount":100,"discount":200}` | `{"error":"Line discount must be between 0 and the line amount"}` | `{"error":"Line discount must be between 0 and the line amount"}` | ✅ Pass |
| I-05 | mixed rates sum per line rounding | `{"rates":[1800,500]}` | `{"subtotal":2001,"discountTotal":0,"taxableTotal":2001,"cgst":115,"sgst":115,"igst":0,"taxTotal":230,"total":2231}` | `{"subtotal":2001,"discountTotal":0,"taxableTotal":2001,"cgst":115,"sgst":115,"igst":0,"taxTotal":230,"total":2231}` | ✅ Pass |
| T-01 | intra-state (KA→KA) ₹1,860 at 18% → CGST 9% + SGST 9% | `{"taxable":186000,"seller":"29","pos":"29"}` | `{"supply":"intra","rateBp":1800,"cgst":16740,"sgst":16740,"igst":0,"total":33480}` | `{"supply":"intra","rateBp":1800,"cgst":16740,"sgst":16740,"igst":0,"total":33480}` | ✅ Pass |
| T-02 | inter-state (KA→MH) → IGST 18% | `{"taxable":186000,"seller":"29","pos":"27"}` | `{"supply":"inter","rateBp":1800,"cgst":0,"sgst":0,"igst":33480,"total":33480}` | `{"supply":"inter","rateBp":1800,"cgst":0,"sgst":0,"igst":33480,"total":33480}` | ✅ Pass |
| T-03 | odd paise: CGST/SGST each rounded half-up | `{"taxable":999,"rateBp":500}` | `{"supply":"intra","rateBp":500,"cgst":25,"sgst":25,"igst":0,"total":50}` | `{"supply":"intra","rateBp":500,"cgst":25,"sgst":25,"igst":0,"total":50}` | ✅ Pass |
| T-04 | missing place of supply is an error, never guessed | `{"pos":null}` | `{"error":"Customer place of supply is not configured"}` | `{"error":"Customer place of supply is not configured"}` | ✅ Pass |
| T-05 | missing seller state is an error | `{"seller":null}` | `{"error":"Seller state is not configured in Settings"}` | `{"error":"Seller state is not configured in Settings"}` | ✅ Pass |
| T-06 | no tax rule → zero tax, no state required | `{"rule":null}` | `{"supply":"none","rateBp":0,"cgst":0,"sgst":0,"igst":0,"total":0}` | `{"supply":"none","rateBp":0,"cgst":0,"sgst":0,"igst":0,"total":0}` | ✅ Pass |

## Payments, dunning, metrics & credits

| ID | Case | Input | Expected | Actual | Result |
|---|---|---|---|---|---|
| K-01 | normalise yearly ₹1,200 → ₹100/month | `{"amount":120000,"interval":"yearly"}` | `10000` | `10000` | ✅ Pass |
| K-02 | normalise weekly ₹120 → ₹520/month | `{"amount":12000,"interval":"weekly"}` | `52000` | `52000` | ✅ Pass |
| K-03 | normalise daily ₹10 → ₹304.17/month | `{"amount":1000,"interval":"daily"}` | `30417` | `30417` | ✅ Pass |
| K-04 | normalise quarterly ₹3,000 → ₹1,000/month | `{"amount":300000,"interval":"monthly","count":3}` | `100000` | `100000` | ✅ Pass |
| K-05 | MRR excludes paused | `{"subs":[{"id":"s1","customerId":"c1","status":"active","recurringAmount":120000,"interval":"yearly","intervalCount":1},{"id":"s2","customerId":"c1","status":"active","recurringAmount":186000,"interval":"monthly","intervalCount":1},{"id":"s3","customerId":"c2"` | `248000` | `248000` | ✅ Pass |
| K-06 | ARR = MRR × 12 | `{"mrr":248000}` | `2976000` | `2976000` | ✅ Pass |
| K-07 | ARPC = MRR / active customers | `{"subs":[{"id":"s1","customerId":"c1","status":"active","recurringAmount":120000,"interval":"yearly","intervalCount":1},{"id":"s2","customerId":"c1","status":"active","recurringAmount":186000,"interval":"monthly","intervalCount":1},{"id":"s3","customerId":"c2"` | `124000` | `124000` | ✅ Pass |
| K-08 | MRR bridge, NRR and GRR | `{"start":"3 subs","end":"1 expanded, 1 churned, 1 new"}` | `{"startMrr":30000,"newMrr":5000,"expansion":5000,"contraction":2000,"churned":10000,"endMrr":28000,"grr":0.6,"nrr":0.7666666666666667,"customerChurnRate":0.3333333333333333}` | `{"startMrr":30000,"newMrr":5000,"expansion":5000,"contraction":2000,"churned":10000,"endMrr":28000,"grr":0.6,"nrr":0.7666666666666667,"customerChurnRate":0.3333333333333333}` | ✅ Pass |
| K-09 | forecast projection labelled growth | `{"history":[100000,110000,121000]}` | `{"projected":[133100,146410],"growthRate":0.1}` | `{"projected":[133100,146410],"growthRate":0.1}` | ✅ Pass |
| N-01 | first failure → retry +1 day | `{"failed":1,"date":"2026-11-15"}` | `{"retryOn":"2026-11-16","exhausted":false}` | `{"retryOn":"2026-11-16","exhausted":false}` | ✅ Pass |
| N-02 | third failure → retry +7 days | `{"failed":3,"date":"2026-11-15"}` | `{"retryOn":"2026-11-22","exhausted":false}` | `{"retryOn":"2026-11-22","exhausted":false}` | ✅ Pass |
| N-03 | fourth failure → exhausted | `{"failed":4}` | `{"retryOn":null,"exhausted":true}` | `{"retryOn":null,"exhausted":true}` | ✅ Pass |
| N-04 | custom sequence [2,5] | `{"failed":2,"policy":[2,5]}` | `{"retryOn":"2026-11-20","exhausted":false}` | `{"retryOn":"2026-11-20","exhausted":false}` | ✅ Pass |
| W-01 | consume within balance | `{"balance":1000,"use":300}` | `{"allowed":true,"balanceAfter":700,"consumed":300,"overageUnits":0,"lowBalance":false,"crossedLowBalance":false}` | `{"allowed":true,"balanceAfter":700,"consumed":300,"overageUnits":0,"lowBalance":false,"crossedLowBalance":false}` | ✅ Pass |
| W-02 | crossing 20% triggers low-balance alert once | `{"balance":300,"use":150}` | `{"allowed":true,"balanceAfter":150,"consumed":150,"overageUnits":0,"lowBalance":true,"crossedLowBalance":true}` | `{"allowed":true,"balanceAfter":150,"consumed":150,"overageUnits":0,"lowBalance":true,"crossedLowBalance":true}` | ✅ Pass |
| W-03 | block policy rejects insufficient | `{"balance":100,"use":150}` | `{"allowed":false,"balanceAfter":100,"consumed":0,"overageUnits":0,"lowBalance":true,"crossedLowBalance":false,"reason":"Insufficient credits (policy: block)"}` | `{"allowed":false,"balanceAfter":100,"consumed":0,"overageUnits":0,"lowBalance":true,"crossedLowBalance":false,"reason":"Insufficient credits (policy: block)"}` | ✅ Pass |
| W-04 | overage policy allows and records overage | `{"balance":100,"use":150,"policy":"overage"}` | `{"allowed":true,"balanceAfter":-50,"consumed":100,"overageUnits":50,"lowBalance":true,"crossedLowBalance":false}` | `{"allowed":true,"balanceAfter":-50,"consumed":100,"overageUnits":50,"lowBalance":true,"crossedLowBalance":false}` | ✅ Pass |
| W-05 | top-up resets threshold base | `{"balance":50,"topUp":500}` | `{"balance":550,"lastTopUp":500,"lowBalancePct":20,"policy":"block"}` | `{"balance":550,"lastTopUp":500,"lowBalancePct":20,"policy":"block"}` | ✅ Pass |
| Y-01 | unpaid before due = confirmed | `{"status":"confirmed","total":1019520,"dueDate":"2026-11-15","amountPaid":0,"amountRefunded":0,"creditNoted":0,"today":"2026-11-10"}` | `confirmed` | `confirmed` | ✅ Pass |
| Y-02 | partial payment = partially_paid, outstanding reduced | `{"amountPaid":500000}` | `{"status":"partially_paid","outstanding":519520}` | `{"status":"partially_paid","outstanding":519520}` | ✅ Pass |
| Y-03 | unpaid after due date = overdue | `{"today":"2026-11-16"}` | `overdue` | `overdue` | ✅ Pass |
| Y-04 | due date itself is not overdue | `{"today":"2026-11-15"}` | `confirmed` | `confirmed` | ✅ Pass |
| Y-05 | fully paid = paid even after due | `{"amountPaid":1019520}` | `paid` | `paid` | ✅ Pass |
| Y-06 | refund re-opens outstanding | `{"amountPaid":1019520,"amountRefunded":19520}` | `{"status":"partially_paid","outstanding":19520}` | `{"status":"partially_paid","outstanding":19520}` | ✅ Pass |
| Y-07 | credit note reduces outstanding | `{"creditNoted":19520,"amountPaid":1000000}` | `paid` | `paid` | ✅ Pass |
| Y-08 | overpayment rejected | `{"amount":2000000}` | `{"error":"Payment exceeds the outstanding amount"}` | `{"error":"Payment exceeds the outstanding amount"}` | ✅ Pass |
| Y-09 | payment on draft rejected | `{"status":"draft"}` | `{"error":"Confirm the invoice before recording payments"}` | `{"error":"Confirm the invoice before recording payments"}` | ✅ Pass |
| Y-10 | zero payment rejected | `{"amount":0}` | `{"error":"Payment amount must be greater than zero"}` | `{"error":"Payment amount must be greater than zero"}` | ✅ Pass |
| Y-11 | cancelled stays cancelled | `{"status":"cancelled"}` | `cancelled` | `cancelled` | ✅ Pass |
| Y-12 | allocate ₹15,000 oldest-due first, remainder unapplied | `{"amount":1500000}` | `{"allocations":[{"invoiceId":"a","amount":1000000},{"invoiceId":"b","amount":400000}],"unapplied":100000}` | `{"allocations":[{"invoiceId":"a","amount":1000000},{"invoiceId":"b","amount":400000}],"unapplied":100000}` | ✅ Pass |
| Y-13 | refund above paid rejected | `{"amountPaid":1000,"refund":1500}` | `{"error":"Refund exceeds the amount paid"}` | `{"error":"Refund exceeds the amount paid"}` | ✅ Pass |
| Y-14 | credit note above total rejected | `{"total":1000,"creditNoted":800,"note":300}` | `{"error":"Credit note exceeds the invoice total"}` | `{"error":"Credit note exceeds the invoice total"}` | ✅ Pass |
| Y-15 | receivables ageing buckets | `{"today":"2026-12-31"}` | `{"current":100,"d1_30":200,"d31_60":300,"d61_90":0,"d90_plus":400}` | `{"current":100,"d1_30":200,"d31_60":300,"d61_90":0,"d90_plus":400}` | ✅ Pass |
| Y-16 | payment success rate ignores pending | `{"s":3,"f":1,"p":2}` | `0.75` | `0.75` | ✅ Pass |

## Billing runner & lifecycle

| ID | Case | Input | Expected | Actual | Result |
|---|---|---|---|---|---|
| B-01 | due today → bill one period, advance to Nov 30 | `{"id":"sub1","status":"active","startDate":"2026-01-31","anchorDate":"2026-01-31","interval":"monthly","intervalCount":1,"nextBillingDate":"2026-10-31","endDate":null,"today":"2026-10-31"}` | `{"action":"bill","periods":[{"start":"2026-10-31","end":"2026-11-29","endExclusive":"2026-11-30"}],"nextBillingDate":"2026-11-30","closeAfter":false}` | `{"action":"bill","periods":[{"start":"2026-10-31","end":"2026-11-29","endExclusive":"2026-11-30"}],"nextBillingDate":"2026-11-30","closeAfter":false}` | ✅ Pass |
| B-02 | not due yet → skip | `{"today":"2026-10-30"}` | `{"action":"skip","reason":"not due"}` | `{"action":"skip","reason":"not due"}` | ✅ Pass |
| B-03 | missed 3 periods → catch up all, none skipped | `{"nextBillingDate":"2026-08-31","today":"2026-10-31"}` | `["2026-08-31","2026-09-30","2026-10-31"]` | `["2026-08-31","2026-09-30","2026-10-31"]` | ✅ Pass |
| B-04 | paused subscription never billed | `{"status":"paused"}` | `{"action":"skip","reason":"status paused"}` | `{"action":"skip","reason":"status paused"}` | ✅ Pass |
| B-05 | does not bill periods starting after expiry | `{"endDate":"2026-09-15","nextBillingDate":"2026-08-31","autoClose":true}` | `{"periods":["2026-08-31"],"closeAfter":true}` | `{"periods":["2026-08-31"],"closeAfter":true}` | ✅ Pass |
| B-06 | expired + auto-close → close | `{"endDate":"2026-10-01","autoClose":true}` | `{"action":"close","reason":"expired"}` | `{"action":"close","reason":"expired"}` | ✅ Pass |
| B-07 | idempotency key is deterministic per period | `{"sub":"sub1","period":"2026-10-31"}` | `sub1__2026-10-31` | `sub1__2026-10-31` | ✅ Pass |
| B-08 | same input twice → same key (no duplicate invoice) | `{}` | `true` | `true` | ✅ Pass |
| L-01 | draft → quotation allowed | `{"from":"draft","action":"send_quotation"}` | `{"ok":true,"to":"quotation"}` | `{"ok":true,"to":"quotation"}` | ✅ Pass |
| L-02 | cannot activate a draft directly | `{"from":"draft","action":"activate"}` | `{"ok":false,"reason":"Cannot activate a draft subscription"}` | `{"ok":false,"reason":"Cannot activate a draft subscription"}` | ✅ Pass |
| L-03 | pause blocked when plan disallows | `{"flags":{"pausable":false}}` | `{"ok":false,"reason":"This plan does not allow pausing"}` | `{"ok":false,"reason":"This plan does not allow pausing"}` | ✅ Pass |
| L-04 | closed cannot be paused | `{"from":"closed"}` | `{"ok":false,"reason":"Cannot pause a closed subscription"}` | `{"ok":false,"reason":"Cannot pause a closed subscription"}` | ✅ Pass |
| L-05 | actions available for active | `{"status":"active"}` | `["pause","renew","close"]` | `["pause","renew","close"]` | ✅ Pass |

## Integration checks (tests/integration/engine.test.ts)

Run against a seeded local store with ~9 months of simulated history and 300 bulk subscriptions: unique invoice numbers, one invoice per subscription-period, idempotent re-runs, concurrent-run lock, CGST/SGST vs IGST by state, variant pricing ₹1,860, failed payments never marking paid, partial → paid → refund, proration invoice/credit, missing place of supply blocking, usage idempotency, analytics < 2 s, assistant role checks. See `npm test` output for pass/fail.
