# CyberForge — Complete System Workflow Flowcharts
*Visual and Algorithmic Flowcharts of Core Platform Processes*

---

## Flowchart 1: Scam Reporting Workflow

```mermaid
flowchart TD
    Start(["Citizen Starts Report"]) --> UI_Input["Enter Identifier, Channel, Scam Category, Pincode, Note, Evidence"]
    UI_Input --> Frontend_Val{"Frontend Client Validation\n(Empty fields, valid types)"}
    
    Frontend_Val -- Invalid --> UI_Error["Display Validation Error in UI"]
    Frontend_Val -- Valid --> HTTP_Post["Send POST /reports with JSON / FormData"]
    
    HTTP_Post --> FastAPI_Recv["FastAPI Ingestion Endpoint (reports.py)"]
    FastAPI_Recv --> Backend_Norm{"Backend Normalization\n(normalize.py)"}
    
    Backend_Norm -- "Malformed / Non-Indian / Junk" --> Resp_400["Return 400 Bad Request\n{'error': 'Invalid identifier'}"]
    Backend_Norm -- "Valid Format" --> Privacy_Hash["Compute HMAC-SHA256 of Reporter ID,\n/24 Subnet IP, Note SHA-256 Fingerprint"]
    
    Privacy_Hash --> Check_Verified{"Check Appendix C\nVerified Registry?"}
    
    Check_Verified -- "Yes (Helpline / Verified Business)" --> Set_Verified_Status["Set Case Verdict = VERIFIED_BUSINESS\nFraud Risk = ZERO"]
    Check_Verified -- "No" --> Fetch_Existing["Fetch All Existing Reports for this Identifier"]
    
    Fetch_Existing --> Anti_Sybil["Execute Anti-Sybil Trust Engine\n(Pairwise Correlation + Union-Find)"]
    Anti_Sybil --> Calc_Metrics["Calculate Distinct Reporters Count\n& Trust Verdict"]
    
    Set_Verified_Status --> DB_Persist["Begin Database Transaction:\n1. INSERT into reports\n2. UPSERT into cases\n3. INSERT into evidence (if attached)"]
    Calc_Metrics --> DB_Persist
    
    DB_Persist --> Check_Spike["Run alert_engine.py\n(Check 24h Pincode Spike or New Scam Type)"]
    Check_Spike --> Resp_201["Return 201 Created:\n{'report_id': '...', 'case_id': '...', 'merged': true/false}"]
    
    Resp_201 --> UI_Success["Frontend Displays Success Card\nRefreshes Local Submission Cache"]
    Resp_400 --> UI_Display_Err["Frontend Alerts User of Input Problem"]
```

---

## Flowchart 2: Trust Engine Decision Workflow

```mermaid
flowchart TD
    Start_Trust(["Evaluate Trust Engine (evaluate_trust)"]) --> Check_Registry{"Is Identifier in\nVerified Business Registry?"}
    
    Check_Registry -- "Yes" --> Ret_Verified["Return ('VERIFIED_BUSINESS', count, 0.0)"]
    Check_Registry -- "No" --> Check_Reports{"Number of Active\nReports for Identifier?"}
    
    Check_Reports -- "0 Reports" --> Ret_NoReports["Return ('NO_REPORTS', 0, 0.0)"]
    Check_Reports -- "Reports > 0" --> Check_Challenged{"Is Case Currently\nChallenged (Under Review)?"}
    
    Check_Challenged -- "Yes (Active Dispute)" --> Cap_Suspicious["Cap Maximum Allowed Verdict\nto 'SUSPICIOUS'\n(Cannot be KNOWN_SCAM)"]
    Check_Challenged -- "No" --> Run_Sybil["Compute Pairwise Multi-Signal Correlation Matrix"]
    
    Cap_Suspicious --> Run_Sybil
    Run_Sybil --> Run_UnionFind["Disjoint-Set Union-Find Clustering\nMerge connected reports into clusters"]
    Run_UnionFind --> Count_Distinct["Count Distinct Clusters = distinct_reporters"]
    
    Count_Distinct --> Check_Distinct{"distinct_reporters\nThreshold Check"}
    
    Check_Distinct -- "distinct_reporters >= 3" --> Check_Disputed_Status{"Was Verdict\nCapped by Dispute?"}
    Check_Disputed_Status -- "Yes" --> Verdict_Suspicious["Final Verdict = 'SUSPICIOUS'\n(Under Investigation)"]
    Check_Disputed_Status -- "No" --> Verdict_KnownScam["Final Verdict = 'KNOWN_SCAM'\n(Confirmed Community Threat)"]
    
    Check_Distinct -- "1 <= distinct_reporters < 3" --> Verdict_Suspicious_Normal["Final Verdict = 'SUSPICIOUS'\n(Awaiting Corroboration)"]
    Check_Distinct -- "distinct_reporters == 0" --> Ret_NoReports
    
    Verdict_KnownScam --> Return_Output(["Return (Verdict, distinct_reporters, confidence)"])
    Verdict_Suspicious --> Return_Output
    Verdict_Suspicious_Normal --> Return_Output
    Ret_Verified --> Return_Output
```

---

## Flowchart 3: Anti-Sybil Multi-Signal & Union-Find Clustering

```mermaid
flowchart TD
    subgraph Input_Data ["Input: N Reports for Same Target Identifier"]
        R1["Report 1: HMAC_A, IP_Subnet_1, File_Hash_X, Time_T0"]
        R2["Report 2: HMAC_B, IP_Subnet_1, File_Hash_X, Time_T0+2m"]
        R3["Report 3: HMAC_C, IP_Subnet_2, File_Hash_Y, Time_T0+5d"]
    end

    Input_Data --> Pairwise_Loop["For Every Pair of Reports (i, j):\nCalculate Multi-Signal Correlation Score"]

    subgraph Signal_Scoring ["Pairwise Similarity Score Weights (similarity.py)"]
        S1["Same Reporter HMAC: +0.40"]
        S2["Identical File SHA-256: +0.35"]
        S3["Same Tx Reference HMAC: +0.30"]
        S4["Perceptual Hash pHash <= 10: +0.25"]
        S5["Identical Note Fingerprint: +0.20"]
        S6["Same /24 Subnet IP Prefix: +0.10"]
        S7["Time Difference < 10 Minutes: +0.10"]
    end

    Pairwise_Loop --> Signal_Scoring
    Signal_Scoring --> Sum_Score["Total Score = Sum of Matching Signal Weights"]
    
    Sum_Score --> Edge_Threshold{"Is Total Score >= 0.50 ?\n(Or Duplicate Reporter HMAC)"}
    
    Edge_Threshold -- "Yes (Coordinated / Duplicate)" --> Add_Edge["Add Undirected Edge Between Report i and Report j"]
    Edge_Threshold -- "No (Independent Evidence)" --> No_Edge["No Edge Added (Independent Sources)"]

    Add_Edge --> Union_Find["Execute Union-Find (Disjoint-Set Algorithm)\nunion(parent[i], parent[j]) with Path Compression"]
    No_Edge --> Union_Find

    Union_Find --> Connected_Components["Find Connected Components\n(Unique Root Parents)"]
    
    Connected_Components --> Example_Result["Example: 40 Bot Reports with Same Screenshot\nAll share File_Hash_X (score >= 0.50)\nUnion-Find collapses all 40 into 1 Single Root Cluster"]
    
    Example_Result --> Final_Count["distinct_reporters = 1\nVerdict stays SUSPICIOUS, NOT KNOWN_SCAM"]
```

---

## Flowchart 4: Identifier Lookup & Privacy Masking

```mermaid
flowchart TD
    Start_Lookup(["User Enters Identifier to Check"]) --> Norm_Lookup["Normalize Input (normalize.py)\ne.g. '+91 98765 43210' -> '+919876543210'"]
    
    Norm_Lookup --> Check_Valid{"Is Identifier\nValid Format?"}
    Check_Valid -- "No (e.g. '12345')" --> Ret_400["Return 400 Bad Request\n{'error': 'Invalid format'}"]
    
    Check_Valid -- "Yes" --> DB_Lookup["Query cases, reports, and verified_businesses tables"]
    
    DB_Lookup --> Check_Found{"Does Record Exist in Database?"}
    
    Check_Found -- "No" --> Ret_No_Reports["Return 200 OK:\n{\n  'verdict': 'NO_REPORTS',\n  'report_count': 0,\n  'distinct_reporters': 0,\n  'display_value': masked_input\n}"]
    
    Check_Found -- "Yes" --> Check_If_Verified{"Is Verified Entity?"}
    
    Check_If_Verified -- "Yes" --> Return_Verified["Return 200 OK:\n{\n  'verdict': 'VERIFIED_BUSINESS',\n  'display_value': Full Official Name,\n  'challenged': false\n}"]
    
    Check_If_Verified -- "No" --> Evaluate_Masking{"distinct_reporters >= 3 ?"}
    
    Evaluate_Masking -- "No (1 or 2 Reporters)" --> Apply_Privacy_Mask["Apply Privacy Masking:\nPhone: 98XXXXX210\nUPI: r***@okaxis\nURL: sbi***.in/...\nSender ID: HD****"]
    Evaluate_Masking -- "Yes (Confirmed Scam)" --> Show_Full_Display["Show Full Value:\n+919876543210"]
    
    Apply_Privacy_Mask --> Build_Evidence_Array["Extract Evidence Array:\n(occurred_at, channel, scam_type, pincode)\nOmit Reporter ID, IP Prefix, and Private Notes"]
    Show_Full_Display --> Build_Evidence_Array
    
    Build_Evidence_Array --> Return_200_Lookup["Return 200 OK Complete Lookup Response"]
    Return_200_Lookup --> UI_Render_Card["Frontend Renders Verdict Badge & Evidence Timeline"]
```

---

## Flowchart 5: Geospatial Scam Map Generation

```mermaid
flowchart TD
    Start_Map(["Client Opens Map View"]) --> Map_Query["GET /map?pincode=560102&days=7&radius_km=2"]
    
    Map_Query --> Parse_Params["Parse Query Parameters\nDefault: days=7, radius_km=2"]
    
    Parse_Params --> Fetch_Area["Resolve Target Pincode Lat/Lng\nfrom areas.py geocoding dictionary"]
    
    Fetch_Area --> DB_Reports["Query reports occurred_at >= (now - 7 days)\nFilter status = 'ACCEPTED'\nExclude quarantined & verified business reports"]
    
    DB_Reports --> Group_Pincode["Group Reports by 6-digit Pincode"]
    
    Group_Pincode --> Radius_Filter{"Calculate Haversine Distance\nfrom Center Pincode to Group Pincode\nDistance <= radius_km?"}
    
    Radius_Filter -- "Beyond Radius" --> Discard_Area["Omit from Response Clusters"]
    Radius_Filter -- "Within Radius" --> Gen_Cluster["Generate Cluster Object:\n- pincode\n- locality & city (from areas.py)\n- count (number of reports in window)\n- top_scam_type (mode category)\n- lat & lng (area centroid from areas.py)\n- severity (CRIT >= 10, HIGH >= 5, MED < 5)"]
    
    Gen_Cluster --> JSON_Resp["Return 200 OK:\n{\n  'clusters': [...],\n  'points': [...],\n  'diagnostics': {...}\n}"]
    
    JSON_Resp --> Leaflet_Render["Frontend React-Leaflet Component:\n1. Sets map center\n2. Draws color-coded circle markers\n3. Binds popup with scam breakdown"]
```

---

## Flowchart 6: Admin Investigation & Dispute Adjudication

```mermaid
flowchart TD
    Admin_Start(["Administrator Opens Admin Console"]) --> Admin_Auth{"Validate Header:\nx-admin-token or Authorization Bearer\nMatches ADMIN_TOKEN?"}
    
    Admin_Auth -- "Unauthorized (Normal User)" --> Err_401["Return 401 Unauthorized"]
    Admin_Auth -- "Authorized or Demo POV" --> Fetch_Disputes["GET /api/admin/disputes\nFetch Pending Business Challenges"]
    
    Fetch_Disputes --> Admin_Review["Admin Inspects:\n- Claimant Name & Business GST/Licence Note\n- Target Disputed Report ID\n- Multi-Signal Sybil Correlation Panel"]
    
    Admin_Review --> Admin_Decision{"Admin Adjudication Action"}
    
    Admin_Decision -- "REJECT (Dismiss Dispute)" --> Post_Reject["POST /admin/disputes/{id}/decide\n{'action': 'REJECT', 'reason': '...'}\nTarget report status stays ACCEPTED\nChallenge status becomes REJECTED"]
    
    Admin_Decision -- "APPROVE (Uphold Dispute)" --> Post_Approve["POST /admin/disputes/{id}/decide\n{'action': 'APPROVE', 'reason': '...'}\nTarget report status -> QUARANTINED\nChallenge status -> RESOLVED"]
    
    Post_Approve --> Recalc_Trust["Recalculate Case Verdict & distinct_reporters\nexcluding the QUARANTINED report"]
    
    Recalc_Trust --> Log_Audit["INSERT into dispute_audit_log:\n(challenge_id, report_id, action, reason, decided_by, timestamp)"]
    Post_Reject --> Log_Audit
    
    Log_Audit --> Ret_Decision_OK["Return 200 OK with Updated Case Status"]
    Ret_Decision_OK --> UI_Refresh["Admin UI Updates Audit Log & Removes Pending Banner"]
```

---

## Flowchart 7: Native Android Connectivity & Local Synchronization

```mermaid
flowchart TD
    User_Phone(["User Launches CyberForge APK on Mobile Phone"]) --> Webview_Init["Capacitor WebView Initializes\nLoads index.html from local asset bundle"]
    
    Webview_Init --> Load_Config["Read API Base URL Configuration\nConfigured to http://192.168.60.239:8000"]
    
    Load_Config --> Check_Network{"Is Mobile Device on\nSame Wi-Fi Network as Laptop?"}
    
    Check_Network -- "No (Mobile Data / Different Wi-Fi)" --> Net_Err["HTTP Connection Refused / Timeout\nNetwork security blocks cleartext to unknown IP"]
    Net_Err --> Show_Offline["Frontend displays Offline Warning\nOffers cached data view"]
    
    Check_Network -- "Yes (Connected to Laptop Subnet)" --> Send_HTTP["WebView sends HTTP GET /health\nvia Android Cleartext Permission\n(network_security_config.xml)"]
    
    Send_HTTP --> Laptop_Firewall{"Windows Firewall & Port 8000\nAccessible to Subnet?"}
    
    Laptop_Firewall -- "Blocked" --> Conn_Timed_Out["Connection Timed Out"]
    Laptop_Firewall -- "Allowed (0.0.0.0:8000)" --> Uvicorn_Recv["Uvicorn Server on Laptop Receives Request"]
    
    Uvicorn_Recv --> Process_Request["Process Request & Return JSON Response"]
    Process_Request --> Android_Recv["Capacitor WebView Receives 200 OK"]
    Android_Recv --> UI_Live["App displays Live Scam Intel, Map Clusters,\nand allows Direct Report Submissions"]
```

