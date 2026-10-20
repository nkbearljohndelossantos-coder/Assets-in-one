# Domain and DNS Configuration Guide
## Subdomain: `asset.nkbmanufacturing.com`

---

## 1. Required DNS Record Specification

To route user traffic for the Unified ITMS + PPE application to your Hostinger VPS, an `A` record must be created in the DNS zone for `nkbmanufacturing.com`:

| Field | Configuration Value | Notes |
| :--- | :--- | :--- |
| **Record Type** | `A` | Maps hostname directly to IPv4 address. |
| **Name / Host** | `asset` | Subdomain prefix (resolves to `asset.nkbmanufacturing.com`). |
| **Points to / Value** | `187.77.143.211` | Hostinger VPS Public IP address. |
| **TTL (Time to Live)**| `300` (or `Automatic` / `14400`) | Set to 300 seconds (5 min) during initial setup for fast propagation. |

---

## 2. Step-by-Step Instructions: Hostinger hPanel DNS Manager

Since `nkbmanufacturing.com` delegates its DNS to Hostinger nameservers (`ns1.dns-parking.com`, `ns2.dns-parking.com`), DNS records are managed directly within Hostinger hPanel:

1. **Log into Hostinger hPanel**:
   Navigate to [https://hpanel.hostinger.com](https://hpanel.hostinger.com) and authenticate.

2. **Open Domain DNS Settings**:
   - In the top navigation, click **Domains**.
   - Select **`nkbmanufacturing.com`**.
   - In the left sidebar, click **DNS / Nameservers** (or **DNS Zone Editor**).

3. **Check for Existing Conflicting Records**:
   - Search the table for `asset`.
   - Ensure there are no conflicting `CNAME`, `AAAA`, or duplicate `A` records for `asset.nkbmanufacturing.com`.
   - If an old or incorrect record exists, click **Edit** or **Delete**.

4. **Add the New A Record**:
   - Under **Manage DNS records** (or **Add new record**):
     - **Type**: Select `A`.
     - **Name**: Enter `asset`.
     - **Points to**: Enter `187.77.143.211`.
     - **TTL**: Enter `300`.
   - Click **Add Record**.

---

## 3. Propagation Verification

DNS changes usually propagate within 5 to 15 minutes. Verify propagation from any terminal:

### PowerShell (Windows):
```powershell
Resolve-DnsName "asset.nkbmanufacturing.com" -Type A
```
Expected output:
```
Name                           Type   TTL   Section    IPAddress
----                           ----   ---   -------    ---------
asset.nkbmanufacturing.com     A      300   Answer     187.77.143.211
```

### Linux / macOS:
```bash
dig +short asset.nkbmanufacturing.com @8.8.8.8
# Output should return: 187.77.143.211

nslookup asset.nkbmanufacturing.com
```

> [!IMPORTANT]
> **Do NOT request an SSL/TLS certificate via Certbot or Let's Encrypt until this DNS check succeeds.**
> Let's Encrypt requires the domain to resolve to the server IP to validate HTTP-01 challenges.
