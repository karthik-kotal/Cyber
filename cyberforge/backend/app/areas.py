import math
from typing import Dict, Any, Optional, List


# Official Appendix B: 25 Area Records
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


def get_area_by_pincode(pincode: Optional[str]) -> Optional[Dict[str, Any]]:
    if not pincode:
        return None
    return APPENDIX_B_AREAS.get(pincode.strip())


def is_valid_pincode(pincode: Optional[str]) -> bool:
    if not pincode:
        return False
    p = pincode.strip()
    return len(p) == 6 and p.isdigit() and p[0] in "123456789"


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


def get_areas_within_radius(center_pincode: str, radius_km: float) -> List[Dict[str, Any]]:
    """Returns all Appendix B areas located within radius_km of center_pincode."""
    center = get_area_by_pincode(center_pincode)
    if not center:
        return []
    
    nearby = []
    c_lat, c_lng = center["lat"], center["lng"]
    for pin, area in APPENDIX_B_AREAS.items():
        dist = haversine_distance_km(c_lat, c_lng, area["lat"], area["lng"])
        if dist <= radius_km:
            nearby.append(area)
    return nearby
