import openpyxl, json, re

wb = openpyxl.load_workbook('/Users/milena/Downloads/mutual_fund_data.xlsx')
ws = wb.active

def s(v):
    if v is None:
        return None
    if isinstance(v, str):
        v = v.strip()
        return v if v else None
    return v

def first_percent(text):
    """Extract the first numeric percent value found in a string."""
    if not text:
        return None
    m = re.search(r'(\d+(?:[.,]\d+)?)\s*%', text)
    if not m:
        return None
    return float(m.group(1).replace(',', '.'))

def max_percent(text):
    """Extract the maximum numeric percent value found in a string."""
    if not text:
        return None
    nums = [float(x.replace(',', '.')) for x in re.findall(r'(\d+(?:[.,]\d+)?)\s*%', text)]
    return max(nums) if nums else None

funds = []
for row in ws.iter_rows(min_row=5, values_only=True):
    if not row[0] or not isinstance(row[1], str):
        continue

    rules_date = row[9]
    if hasattr(rules_date, 'strftime'):
        rules_date = rules_date.strftime('%d.%m.%Y')

    yield12 = row[21]
    if isinstance(yield12, (int, float)):
        yield12_pct = round(yield12 * 100, 2)
    else:
        yield12_pct = None

    mgmt_fee_text = s(row[13])
    success_fee_text = s(row[14])
    infra_fee_text = s(row[15])
    max_exp_text = s(row[16])
    premiums_text = s(row[19])
    discounts_text = s(row[20])

    fund = {
        'rulesNumber': s(row[0]),
        'name': s(row[1]),
        'isin': s(row[2]),
        'type': s(row[3]),
        'category': s(row[4]),
        'status': s(row[5]),
        'company': s(row[6]),
        'companyInn': s(row[7]),
        'companySite': s(row[8]),
        'rulesDate': rules_date,
        'strategy': s(row[10]),
        'benchmark': s(row[11]),
        'deviation': s(row[12]),
        'managementFee': mgmt_fee_text,
        'managementFeePct': first_percent(mgmt_fee_text),
        'successFee': success_fee_text,
        'infraFee': infra_fee_text,
        'maxExpenses': max_exp_text,
        'maxExpensesPct': first_percent(max_exp_text),
        'incomeRight': s(row[17]),
        'incomePeriod': s(row[18]),
        'premiums': premiums_text,
        'premiumsMaxPct': max_percent(premiums_text),
        'discounts': discounts_text,
        'discountsMaxPct': max_percent(discounts_text),
        'yield12m': yield12_pct,
    }
    funds.append(fund)

print('total funds:', len(funds))

with open('funds-data.js', 'w', encoding='utf-8') as f:
    f.write('// Данные ПИФ, актуальность: 30.04.2026 (источник: Банк России, cbr.ru/RSCI/data_showcase/)\n')
    f.write('const FUNDS_DATA = ')
    json.dump(funds, f, ensure_ascii=False, indent=1)
    f.write(';\n')
    f.write('const FUNDS_UPDATED = "30.04.2026";\n')
