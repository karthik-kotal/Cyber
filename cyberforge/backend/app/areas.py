import math
from typing import Dict, Any, Optional, List, Tuple


# Official Appendix B: 25 Core Area Records (Required by PRD Specification)
APPENDIX_B_AREAS: Dict[str, Dict[str, Any]] = {
    "560102": {"pincode": "560102", "locality": "HSR Layout", "city": "Bengaluru", "lat": 12.9116, "lng": 77.6473},
    "560038": {"pincode": "560038", "locality": "Indiranagar", "city": "Bengaluru", "lat": 12.9784, "lng": 77.6408},
    "560034": {"pincode": "560034", "locality": "Koramangala", "city": "Bengaluru", "lat": 12.9352, "lng": 77.6245},
    "560066": {"pincode": "560066", "locality": "Whitefield", "city": "Bengaluru", "lat": 12.9698, "lng": 77.7500},
    "560076": {"pincode": "560076", "locality": "BTM Layout", "city": "Bengaluru", "lat": 12.9166, "lng": 77.6101},
    "560011": {"pincode": "560011", "locality": "Jayanagar", "city": "Bengaluru", "lat": 12.9299, "lng": 77.5826},
    "560037": {"pincode": "560037", "locality": "Marathahalli", "city": "Bengaluru", "lat": 12.9591, "lng": 77.6974},
    "560103": {"pincode": "560103", "locality": "Bellandur", "city": "Bengaluru", "lat": 12.9260, "lng": 77.6762},
    "560100": {"pincode": "560100", "locality": "Electronic City", "city": "Bengaluru", "lat": 12.8452, "lng": 77.6602},
    "560078": {"pincode": "560078", "locality": "JP Nagar", "city": "Bengaluru", "lat": 12.9077, "lng": 77.5851},
    "560003": {"pincode": "560003", "locality": "Malleshwaram", "city": "Bengaluru", "lat": 13.0035, "lng": 77.5709},
    "560010": {"pincode": "560010", "locality": "Rajajinagar", "city": "Bengaluru", "lat": 12.9915, "lng": 77.5520},
    "560024": {"pincode": "560024", "locality": "Hebbal", "city": "Bengaluru", "lat": 13.0358, "lng": 77.5970},
    "560064": {"pincode": "560064", "locality": "Yelahanka", "city": "Bengaluru", "lat": 13.1007, "lng": 77.5963},
    "560070": {"pincode": "560070", "locality": "Banashankari", "city": "Bengaluru", "lat": 12.9250, "lng": 77.5468},
    "400050": {"pincode": "400050", "locality": "Bandra West", "city": "Mumbai", "lat": 19.0596, "lng": 72.8295},
    "110016": {"pincode": "110016", "locality": "Hauz Khas", "city": "Delhi", "lat": 28.5494, "lng": 77.2001},
    "500081": {"pincode": "500081", "locality": "Madhapur", "city": "Hyderabad", "lat": 17.4486, "lng": 78.3908},
    "600020": {"pincode": "600020", "locality": "Adyar", "city": "Chennai", "lat": 13.0012, "lng": 80.2565},
    "411014": {"pincode": "411014", "locality": "Viman Nagar", "city": "Pune", "lat": 18.5679, "lng": 73.9143},
    "700091": {"pincode": "700091", "locality": "Salt Lake Sector V", "city": "Kolkata", "lat": 22.5790, "lng": 88.4290},
    "380015": {"pincode": "380015", "locality": "Satellite", "city": "Ahmedabad", "lat": 23.0260, "lng": 72.5085},
    "302017": {"pincode": "302017", "locality": "Malviya Nagar", "city": "Jaipur", "lat": 26.8570, "lng": 75.8080},
    "226010": {"pincode": "226010", "locality": "Gomti Nagar", "city": "Lucknow", "lat": 26.8540, "lng": 80.9990},
    "682030": {"pincode": "682030", "locality": "Kakkanad", "city": "Kochi", "lat": 10.0159, "lng": 76.3419},
}

# Extended Recognized Areas: additional verified geographic centroids for Indian cities and key neighborhoods
EXTENDED_AREAS: Dict[str, Dict[str, Any]] = {
    # Bengaluru Extended
    "560050": {"pincode": "560050", "locality": "Basavanagudi", "city": "Bengaluru", "lat": 12.9416, "lng": 77.5753},
    "560001": {"pincode": "560001", "locality": "Bangalore GPO / MG Road", "city": "Bengaluru", "lat": 12.9780, "lng": 77.5996},
    "560002": {"pincode": "560002", "locality": "City Market", "city": "Bengaluru", "lat": 12.9647, "lng": 77.5768},
    "560004": {"pincode": "560004", "locality": "Gandhi Bazaar", "city": "Bengaluru", "lat": 12.9421, "lng": 77.5753},
    "560025": {"pincode": "560025", "locality": "Richmond Town", "city": "Bengaluru", "lat": 12.9667, "lng": 77.6075},
    "560008": {"pincode": "560008", "locality": "Ulsoor", "city": "Bengaluru", "lat": 12.9817, "lng": 77.6286},
    "560047": {"pincode": "560047", "locality": "Austin Town", "city": "Bengaluru", "lat": 12.9575, "lng": 77.6186},
    "560068": {"pincode": "560068", "locality": "Madivala / Bommanahalli", "city": "Bengaluru", "lat": 12.9160, "lng": 77.6230},
    "560007": {"pincode": "560007", "locality": "Domlur", "city": "Bengaluru", "lat": 12.9609, "lng": 77.6387},
    "560017": {"pincode": "560017", "locality": "Vimanapura / HAL", "city": "Bengaluru", "lat": 12.9553, "lng": 77.6682},
    # Delhi Extended
    "110001": {"pincode": "110001", "locality": "Connaught Place", "city": "Delhi", "lat": 28.6315, "lng": 77.2167},
    # Mumbai Extended
    "400001": {"pincode": "400001", "locality": "Fort / Mumbai GPO", "city": "Mumbai", "lat": 18.9388, "lng": 72.8354},
    # Hyderabad Extended
    "500001": {"pincode": "500001", "locality": "Hyderabad GPO", "city": "Hyderabad", "lat": 17.3850, "lng": 78.4867},
    # Chennai Extended
    "600001": {"pincode": "600001", "locality": "Chennai GPO / George Town", "city": "Chennai", "lat": 13.0878, "lng": 80.2785},
    # Kolkata Extended
    "700001": {"pincode": "700001", "locality": "BBD Bagh / Kolkata GPO", "city": "Kolkata", "lat": 22.5726, "lng": 88.3511},
}

# Pincodes that resolve directly to a shared neighborhood centroid (multiple pincodes -> same area)
PINCODE_ALIASES: Dict[str, str] = {
    "560095": "560034",  # Koramangala South -> Koramangala centroid
    "560029": "560076",  # BTM 1st Stage -> BTM Layout centroid
    "560005": "560008",  # Frazer Town / Ulsoor vicinity -> Ulsoor centroid
    "400051": "400050",  # Bandra East -> Bandra West area cluster
}

# Regional decoding by the first 2 digits of an Indian PIN code
PINCODE_PREFIX_REGIONS: Dict[str, Tuple[str, str]] = {
    "11": ("Delhi", "Delhi"),
    "12": ("Haryana", "Faridabad/Gurgaon"),
    "13": ("Haryana", "Ambala/Panipat"),
    "14": ("Punjab", "Amritsar/Ludhiana"),
    "15": ("Punjab", "Bathinda/Firozpur"),
    "16": ("Chandigarh", "Chandigarh"),
    "17": ("Himachal Pradesh", "Shimla"),
    "18": ("Jammu & Kashmir", "Jammu"),
    "19": ("Jammu & Kashmir", "Srinagar"),
    "20": ("Uttar Pradesh", "Ghaziabad/Noida"),
    "21": ("Uttar Pradesh", "Kanpur/Prayagraj"),
    "22": ("Uttar Pradesh", "Lucknow/Varanasi"),
    "23": ("Uttar Pradesh", "Mirzapur"),
    "24": ("Uttarakhand", "Dehradun/Haridwar"),
    "25": ("Uttar Pradesh", "Meerut"),
    "26": ("Uttarakhand", "Nainital"),
    "27": ("Uttar Pradesh", "Gorakhpur"),
    "28": ("Uttar Pradesh", "Agra/Jhansi"),
    "30": ("Rajasthan", "Jaipur"),
    "31": ("Rajasthan", "Udaipur"),
    "32": ("Rajasthan", "Kota"),
    "33": ("Rajasthan", "Bikaner"),
    "34": ("Rajasthan", "Jodhpur"),
    "36": ("Gujarat", "Rajkot"),
    "37": ("Gujarat", "Kutch"),
    "38": ("Gujarat", "Ahmedabad"),
    "39": ("Gujarat", "Surat/Vadodara"),
    "40": ("Maharashtra", "Mumbai"),
    "41": ("Maharashtra", "Pune"),
    "42": ("Maharashtra", "Nashik"),
    "43": ("Maharashtra", "Chhatrapati Sambhaji Nagar"),
    "44": ("Maharashtra", "Nagpur"),
    "45": ("Madhya Pradesh", "Indore"),
    "46": ("Madhya Pradesh", "Bhopal"),
    "47": ("Madhya Pradesh", "Gwalior"),
    "48": ("Madhya Pradesh", "Jabalpur"),
    "49": ("Chhattisgarh", "Raipur"),
    "50": ("Telangana", "Hyderabad"),
    "51": ("Andhra Pradesh", "Tirupati/Kurnool"),
    "52": ("Andhra Pradesh", "Vijayawada/Guntur"),
    "53": ("Andhra Pradesh", "Visakhapatnam"),
    "56": ("Karnataka", "Bengaluru"),
    "57": ("Karnataka", "Mangaluru/Mysuru"),
    "58": ("Karnataka", "Hubballi/Belagavi"),
    "59": ("Karnataka", "Kalaburagi/Bidar"),
    "60": ("Tamil Nadu", "Chennai"),
    "61": ("Tamil Nadu", "Thanjavur"),
    "62": ("Tamil Nadu", "Madurai"),
    "63": ("Tamil Nadu", "Salem/Vellore"),
    "64": ("Tamil Nadu", "Coimbatore"),
    "67": ("Kerala", "Kozhikode/Kannur"),
    "68": ("Kerala", "Kochi/Thrissur"),
    "69": ("Kerala", "Thiruvananthapuram"),
    "70": ("West Bengal", "Kolkata"),
    "71": ("West Bengal", "Howrah/Hooghly"),
    "72": ("West Bengal", "Midnapore"),
    "73": ("West Bengal", "Siliguri"),
    "74": ("West Bengal", "Nadia/North 24 Parganas"),
    "75": ("Odisha", "Bhubaneswar/Cuttack"),
    "76": ("Odisha", "Berhampur"),
    "77": ("Odisha", "Sambalpur/Rourkela"),
    "78": ("Assam", "Guwahati"),
    "79": ("North East", "Shillong/Imphal/Agartala"),
    "80": ("Bihar", "Patna"),
    "81": ("Bihar", "Bhagalpur"),
    "82": ("Jharkhand", "Ranchi"),
    "83": ("Jharkhand", "Jamshedpur"),
    "84": ("Bihar", "Muzaffarpur"),
    "85": ("Bihar", "Purnia"),
}


def is_valid_pincode(pincode: Optional[Any]) -> bool:
    """Validates whether a given value follows the 6-digit Indian PIN code format (starts with 1-9)."""
    if pincode is None:
        return False
    p = str(pincode).strip()
    return len(p) == 6 and p.isdigit() and p[0] in "123456789"


def get_area_by_pincode(pincode: Optional[Any]) -> Optional[Dict[str, Any]]:
    """Legacy resolver for backward compatibility: checks Appendix B areas and aliases."""
    if pincode is None:
        return None
    p = str(pincode).strip()
    # Direct Appendix B match
    if p in APPENDIX_B_AREAS:
        return APPENDIX_B_AREAS[p]
    # Check aliases that point to an Appendix B area
    target_pin = PINCODE_ALIASES.get(p)
    if target_pin and target_pin in APPENDIX_B_AREAS:
        base = APPENDIX_B_AREAS[target_pin].copy()
        base["pincode"] = p  # preserve requested pincode
        return base
    # Extended areas
    if p in EXTENDED_AREAS:
        return EXTENDED_AREAS[p]
    return None


def resolve_pincode_area(pincode: Optional[Any]) -> Optional[Dict[str, Any]]:
    """
    Comprehensive area resolver.
    - If format is invalid: returns None.
    - If mapped (Appendix B, Extended, or Alias): returns dict with exact coordinates and is_mapped=True.
    - If valid 6-digit pincode but without registered coordinates: returns region info with lat=None, lng=None, is_mapped=False.
    """
    if pincode is None or not is_valid_pincode(pincode):
        return None

    p = str(pincode).strip()

    # 1. Appendix B primary
    if p in APPENDIX_B_AREAS:
        info = dict(APPENDIX_B_AREAS[p])
        info["primary_pincode"] = p
        info["is_mapped"] = True
        return info

    # 2. Aliases resolving to another primary area
    target_pin = PINCODE_ALIASES.get(p)
    if target_pin:
        primary_area = APPENDIX_B_AREAS.get(target_pin) or EXTENDED_AREAS.get(target_pin)
        if primary_area:
            return {
                "pincode": p,
                "primary_pincode": target_pin,
                "locality": primary_area["locality"],
                "city": primary_area["city"],
                "lat": primary_area["lat"],
                "lng": primary_area["lng"],
                "is_mapped": True,
            }

    # 3. Extended registered areas
    if p in EXTENDED_AREAS:
        info = dict(EXTENDED_AREAS[p])
        info["primary_pincode"] = p
        info["is_mapped"] = True
        return info

    # 4. Valid PIN code, but geographic centroid not yet in coordinate registry
    prefix = p[:2]
    state, region = PINCODE_PREFIX_REGIONS.get(prefix, ("India", "Unmapped Region"))
    return {
        "pincode": p,
        "primary_pincode": p,
        "locality": f"Pincode {p}",
        "city": f"{region}, {state}",
        "lat": None,
        "lng": None,
        "is_mapped": False,
    }


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two GPS coordinates in kilometers."""
    R = 6371.0  # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def get_all_mapped_areas() -> Dict[str, Dict[str, Any]]:
    """Returns a merged dictionary of all areas with known latitude/longitude coordinates."""
    all_areas = dict(APPENDIX_B_AREAS)
    all_areas.update(EXTENDED_AREAS)
    return all_areas


def get_areas_within_radius(center_pincode: str, radius_km: float) -> List[Dict[str, Any]]:
    """Returns all known mapped areas located within radius_km of center_pincode."""
    center = resolve_pincode_area(center_pincode)
    if not center or not center.get("is_mapped") or center.get("lat") is None:
        return []

    nearby = []
    c_lat, c_lng = center["lat"], center["lng"]
    all_mapped = get_all_mapped_areas()

    for pin, area in all_mapped.items():
        dist = haversine_distance_km(c_lat, c_lng, area["lat"], area["lng"])
        if dist <= radius_km:
            nearby.append(area)
    return nearby
