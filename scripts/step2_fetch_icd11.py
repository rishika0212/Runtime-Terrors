# scripts/step2_fetch_icd11.py

import os
import requests
import json
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env")

CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")

TOKEN_URL = "https://icdaccessmanagement.who.int/connect/token"
BASE_URL = "https://id.who.int/icd/release/11/2024-01/mms"

OUTPUT_DIR = "db/icd11"
os.makedirs(OUTPUT_DIR, exist_ok=True)


def get_access_token():
    """Get OAuth2 token from WHO ICD API"""
    data = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "scope": "icdapi_access",
        "grant_type": "client_credentials"
    }

    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    resp = requests.post(TOKEN_URL, data=data, headers=headers)

    if resp.status_code == 200:
        print("✅ Got access token")
        return resp.json()["access_token"]
    else:
        raise Exception(f"❌ Failed to fetch token: {resp.status_code} {resp.text}")


def fetch_icd11(url: str, filename: str, token: str):
    """Fetch ICD-11 JSON from WHO API and save it"""
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "API-Version": "v2",
        "Accept-Language": "en"
    }

    resp = requests.get(url, headers=headers)

    if resp.status_code == 200:
        with open(os.path.join(OUTPUT_DIR, filename), "w", encoding="utf-8") as f:
            json.dump(resp.json(), f, indent=2, ensure_ascii=False)
        print(f"✅ Saved {filename}")
        return resp.json()
    else:
        print(f"❌ Error {resp.status_code}: {resp.text}")
        return None


def find_tm2_child(root_json):
    """Find the TM2 child URL from root /mms JSON"""
    for child_url in root_json.get("child", []):
        child_data = fetch_icd11(child_url, "temp_child.json", token)
        if child_data:
            title = child_data.get("title", {}).get("@value", "").lower()
            if "traditional medicine" in title or "tm2" in title:
                # Found TM2
                return child_url
    return None


if __name__ == "__main__":
    token = get_access_token()

    # Step 1: Fetch root /mms
    root_json = fetch_icd11(BASE_URL, "icd11_root.json", token)

    # Step 2: Find TM2 child URL
    tm2_url = find_tm2_child(root_json)
    if tm2_url:
        fetch_icd11(tm2_url, "icd11_tm2.json", token)
    else:
        print("❌ TM2 child not found")

    # Step 3: Save Biomedicine JSON (all chapters under /mms)
    fetch_icd11(BASE_URL, "icd11_biomedicine.json", token)
