# Newly issued California contractor licenses: free script

Filter the California Contractors State License Board (CSLB) public data-portal file down to licenses issued in the last N days.

## Usage
1. Download the master contractor list (CSV) from the CSLB Data Portal: https://www.cslb.ca.gov/onlineservices/dataportal/
2. Run:

    python3 fresh_licenses.py ContractorList.csv --days 30 --city "San Diego" > fresh.csv

Options: `--days N` (default 30), `--city NAME` (optional filter).

The script has no dependencies beyond Python 3. It detects the issue-date, city and business-name columns by header name, and it handles the common date formats MM/DD/YYYY and YYYY-MM-DD.

## Don't want to run it every week?
A cleaned, deduplicated CSV that refreshes weekly (business, class, city, phone where publicly listed, issue date) is sold as a subscription:
https://rasengan.win/ ($29/month; sample rows on the page)

## Notes
The data is public record from CSLB. Check CSLB's terms of use for your own use case. Using it for cold outreach means following CAN-SPAM and TCPA rules (phone numbers). This is not legal advice.
