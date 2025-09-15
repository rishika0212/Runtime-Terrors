# scripts/step2_fetch_icd11.py

import os
import time
import requests
import json
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from dotenv import load_dotenv
from pathlib import Path
from urllib.parse import urlparse

# Load environment variables
load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env")

CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")

TOKEN_URL = "https://icdaccessmanagement.who.int/connect/token"
BASE_URL = "https://id.who.int/icd/release/11/2024-01/mms"

OUTPUT_DIR = "db/icd11"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Global mutable token
TOKEN = None

# Shared session with retries
session = requests.Session()
retries = Retry(
    total=3,
    backoff_factor=1,
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["GET", "POST"]
)
session.mount("https://", HTTPAdapter(max_retries=retries))
session.mount("http://", HTTPAdapter(max_retries=retries))


def get_access_token():
    """Get OAuth2 token from WHO ICD API and store globally"""
    global TOKEN
    if not CLIENT_ID or not CLIENT_SECRET:
        raise RuntimeError("CLIENT_ID/CLIENT_SECRET missing in .env. Please add them before running.")

    data = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "scope": "icdapi_access",
        "grant_type": "client_credentials"
    }

    headers = {"Content-Type": "application/x-www-form-urlencoded", "User-Agent": "ICD-Client/1.0"}
    resp = session.post(TOKEN_URL, data=data, headers=headers, timeout=30)

    if resp.status_code == 200:
        TOKEN = resp.json()["access_token"]
        print("✅ Got access token")
        return TOKEN
    else:
        raise Exception(f"❌ Failed to fetch token: {resp.status_code} {resp.text}")


def _file_name_from_url(url: str) -> str:
    """Create a stable file name from an ICD URL."""
    path = urlparse(url).path.rstrip("/")
    last = path.split("/")[-1]
    return f"{last}.json"


def fetch_icd11(url: str):
    """Fetch ICD-11 JSON from WHO API and save it; returns parsed JSON.
    Refreshes token on 401 and retries once; polite backoff on 429; retries on transient errors.
    """
    global TOKEN
    fname = _file_name_from_url(url)
    out_path = os.path.join(OUTPUT_DIR, fname)

    # Avoid refetch if cached
    if os.path.exists(out_path):
        with open(out_path, encoding="utf-8") as f:
            return json.load(f)

    if not TOKEN:
        TOKEN = get_access_token()

    def _do_request():
        headers = {
            "Authorization": f"Bearer {TOKEN}",
            "Accept": "application/json",
            "API-Version": "v2",
            "Accept-Language": "en",
            "User-Agent": "ICD-Client/1.0"
        }
        return session.get(url, headers=headers, timeout=90)

    # Try up to 3 attempts for network stability
    attempts = 0
    while attempts < 3:
        attempts += 1
        try:
            resp = _do_request()
        except requests.exceptions.RequestException as e:
            if attempts < 3:
                time.sleep(2 * attempts)
                continue
            print(f"❌ Network error fetching {url}: {e}")
            return None

        # Handle rate limiting
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", "1"))
            time.sleep(min(retry_after, 5))
            continue

        # If token expired/invalid, refresh once and retry
        if resp.status_code == 401:
            try:
                TOKEN = get_access_token()
            except Exception as e:
                print(f"❌ Unable to refresh token: {e}")
                return None
            # retry next loop
            continue

        if resp.status_code == 200:
            try:
                data = resp.json()
            except ValueError:
                print(f"❌ Invalid JSON for {url}")
                return None
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"✅ Saved {fname}")
            return data
        else:
            # Transient server errors: retry
            if resp.status_code in (500, 502, 503, 504):
                time.sleep(1 * attempts)
                continue
            print(f"❌ Error {resp.status_code}: {resp.text}")
            return None

    return None


def crawl_icd_tree(start_url: str, seen: set | None = None):
    """Recursively fetch all nodes reachable via 'child' links starting at start_url."""
    if seen is None:
        seen = set()
    if start_url in seen:
        return
    seen.add(start_url)

    data = fetch_icd11(start_url)
    if not data:
        return

    # Be polite to the API
    time.sleep(0.2)

    for child_url in data.get("child", []):
        crawl_icd_tree(child_url, seen)


def find_tm2_child(root_json):
    """Find the TM2 child URL from root /mms JSON"""
    for child_url in root_json.get("child", []):
        child_data = fetch_icd11(child_url)
        if child_data:
            title = child_data.get("title", {}).get("@value", "").lower()
            if "traditional medicine" in title or "tm2" in title or "tm" in title:
                return child_url
    return None


if __name__ == "__main__":
    get_access_token()

    # Fetch and cache Biomedicine root, then crawl its tree
    root_json = fetch_icd11(BASE_URL)
    tm2_url = None
    if root_json:
        print("🔎 Crawling ICD-11 Biomedicine tree...")
        crawl_icd_tree(BASE_URL)

        # Find and crawl TM2 if present
        print("🔎 Looking for TM2 subtree...")
        tm2_url = find_tm2_child(root_json)
        if tm2_url:
            print(f"🔎 Crawling TM2 tree at {tm2_url} ...")
            crawl_icd_tree(tm2_url)
        else:
            print("❌ TM2 child not found")

    # Persist roots metadata for downstream scripts
    roots_meta = {
        "biomedicine_root": BASE_URL,
        "tm2_root": tm2_url
    }
    meta_path = os.path.join(OUTPUT_DIR, "_roots.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(roots_meta, f, indent=2)
    print(f"📝 Wrote roots metadata to {meta_path}")

    print("✅ ICD-11 content cached under db/icd11")
