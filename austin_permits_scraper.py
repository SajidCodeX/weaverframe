import requests
import json
import csv
from datetime import datetime

# Socrata API for Austin, TX Issued Construction Permits
# Dataset ID: 3syk-w9eu
API_URL = "https://data.austintexas.gov/resource/3syk-w9eu.json"

def fetch_and_clean_permits(limit=100):
    print(f"Fetching latest {limit} residential building permits from Austin Open Data...")
    
    # Query parameters
    # We filter by Building Permits (BP) that are Residential and Work Class is "New"
    params = {
        "permittype": "BP",
        "permit_class_mapped": "Residential",
        "work_class": "New",
        "$where": "total_job_valuation >= 50000",
        "$limit": limit,
        "$order": "issue_date DESC"
    }
    
    # Optional Socrata App Token for higher rate limits
    headers = {}
    import os
    # Load .env manually if dotenv isn't installed
    if os.path.exists(".env"):
        with open(".env", "r") as f:
            for line in f:
                if "=" in line and not line.strip().startswith("#"):
                    parts = line.strip().split("=", 1)
                    if len(parts) == 2:
                        k, v = parts
                        os.environ[k.strip()] = v.strip().strip('"').strip("'")
                    
    token = os.environ.get("AUSTIN_SOCRATA_APP_TOKEN")
    if token:
        headers["X-App-Token"] = token
        print("Using Socrata App Token for authenticated request.")
    
    try:
        response = requests.get(API_URL, params=params, headers=headers)
        response.raise_for_status()
        raw_data = response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data: {e}")
        return []

    cleaned_leads = []
    
    for record in raw_data:
        contractor = record.get("contractor_full_name", "").strip()
        if contractor and contractor.lower() != "none" and contractor.lower() != "tbd" and contractor.lower() != "to be determined":
            # Skip permits that already have a contractor listed
            continue

        name = record.get("applicant_full_name", "").strip()
        if not name or name.lower() == "none":
            # Let's try to get owner info directly if applicant is none
            name = "Homeowner (Direct)"
            
        phone = record.get("applicant_phone", "").strip()
        if not phone or phone.lower() == "none":
            phone = ""
            
        # Format phone (basic cleanup)
        if len(phone) == 10 and phone.isdigit():
            phone = f"({phone[:3]}) {phone[3:6]}-{phone[6:]}"
            
        # Valuation (Budget)
        try:
            budget = float(record.get("total_job_valuation", 0))
        except ValueError:
            budget = 0
            
        if budget < 50000:
            # Skip permits under $50,000 (only target custom builders / high-value constructions)
            continue
            
        # Determine score based on budget
        if budget > 500000:
            score = "Hot"
        elif budget > 150000:
            score = "Warm"
        else:
            score = "Cold"
            
        # Format date
        issue_date_str = record.get("issue_date", "")
        formatted_date = ""
        if issue_date_str:
            try:
                # Socrata usually returns ISO string "YYYY-MM-DDTHH:MM:SS.000"
                dt = datetime.fromisoformat(issue_date_str.split("T")[0])
                formatted_date = dt.strftime("%Y-%m-%d")
            except ValueError:
                formatted_date = issue_date_str

        # Address mapping
        address = record.get("original_address1", "").strip()
        city = record.get("original_city", "AUSTIN").strip()
        state = record.get("original_state", "TX").strip()
        zip_code = record.get("original_zip", "").strip()
        
        # Build clean lead object
        lead = {
            "name": name.title(),
            "phone": phone,
            "address": address.title(),
            "city": city.title(),
            "state": state.upper(),
            "zip": zip_code,
            "budget": int(budget),
            "permit_type": record.get("work_class", "New Construction").title(),
            "issue_date": formatted_date,
            "score_tier": score,
            "status": "New",
            "county": "Travis County"
        }
        
        cleaned_leads.append(lead)

    # Sort by highest budget and take the top 20
    cleaned_leads.sort(key=lambda x: x["budget"], reverse=True)
    cleaned_leads = cleaned_leads[:20]

    print(f"Successfully cleaned and selected top {len(cleaned_leads)} highest budget leads with no contractor.")
    return cleaned_leads

def export_to_csv(data, filename="austin_leads.csv"):
    if not data:
        print("No data to export.")
        return
        
    keys = data[0].keys()
    with open(filename, "w", newline="", encoding="utf-8") as f:
        dict_writer = csv.DictWriter(f, fieldnames=keys)
        dict_writer.writeheader()
        dict_writer.writerows(data)
    print(f"Success: Data exported successfully to {filename}")

def export_to_json(data, filename="austin_leads.json"):
    if not data:
        print("No data to export.")
        return
        
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)
    print(f"Success: Data exported successfully to {filename}")

if __name__ == "__main__":
    print("--- Austin, TX Building Permits Scraper (Top 20 Filter) ---")
    leads_data = fetch_and_clean_permits(limit=2000)
    
    if leads_data:
        export_to_csv(leads_data, "austin_leads.csv")
        export_to_json(leads_data, "austin_leads.json")
        print("\nYou can now import these files into your dashboard database!")
