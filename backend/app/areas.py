"""
Community Scam Map for India — Nationwide Area and Geographic Centroid Registry.

Attribution: Open postal directory data; approximate postal circle and district headquarters centroids.
Bounding Box: Coordinates strictly lie within India (6.0 <= lat <= 37.5, 68.0 <= lng <= 97.5).
"""

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

# Extended Recognized Areas: Nationwide coverage across all 28 states and 8 union territories
# Open postal directory data; approximate postal circle and district headquarters centroids
EXTENDED_AREAS: Dict[str, Dict[str, Any]] = {
    # --- Karnataka Hubs ---
    "560001": {"pincode": "560001", "locality": "Bangalore GPO / MG Road", "city": "Bengaluru", "lat": 12.9780, "lng": 77.5996},
    "560002": {"pincode": "560002", "locality": "City Market", "city": "Bengaluru", "lat": 12.9647, "lng": 77.5768},
    "560004": {"pincode": "560004", "locality": "Gandhi Bazaar", "city": "Bengaluru", "lat": 12.9421, "lng": 77.5753},
    "560007": {"pincode": "560007", "locality": "Domlur", "city": "Bengaluru", "lat": 12.9609, "lng": 77.6387},
    "560008": {"pincode": "560008", "locality": "Ulsoor", "city": "Bengaluru", "lat": 12.9817, "lng": 77.6286},
    "560017": {"pincode": "560017", "locality": "Vimanapura / HAL", "city": "Bengaluru", "lat": 12.9553, "lng": 77.6682},
    "560025": {"pincode": "560025", "locality": "Richmond Town", "city": "Bengaluru", "lat": 12.9667, "lng": 77.6075},
    "560047": {"pincode": "560047", "locality": "Austin Town", "city": "Bengaluru", "lat": 12.9575, "lng": 77.6186},
    "560050": {"pincode": "560050", "locality": "Basavanagudi", "city": "Bengaluru", "lat": 12.9416, "lng": 77.5753},
    "560068": {"pincode": "560068", "locality": "Madivala / Bommanahalli", "city": "Bengaluru", "lat": 12.9160, "lng": 77.6230},
    "560069": {"pincode": "560069", "locality": "Jayanagar 9th Block", "city": "Bengaluru", "lat": 12.9200, "lng": 77.5950},
    "560041": {"pincode": "560041", "locality": "Jayanagar 4th Block", "city": "Bengaluru", "lat": 12.9279, "lng": 77.5873},
    "575001": {"pincode": "575001", "locality": "Mangaluru HO", "city": "Mangaluru", "lat": 12.9141, "lng": 74.8560},
    "580020": {"pincode": "580020", "locality": "Hubballi HO", "city": "Hubballi", "lat": 15.3647, "lng": 75.1240},
    "583101": {"pincode": "583101", "locality": "Ballari HO", "city": "Ballari", "lat": 15.1394, "lng": 76.9214},
    "585101": {"pincode": "585101", "locality": "Kalaburagi HO", "city": "Kalaburagi", "lat": 17.3297, "lng": 76.8343},
    "590001": {"pincode": "590001", "locality": "Belagavi HO", "city": "Belagavi", "lat": 15.8497, "lng": 74.4977},
    "577001": {"pincode": "577001", "locality": "Davanagere HO", "city": "Davanagere", "lat": 14.4644, "lng": 75.9218},
    "577201": {"pincode": "577201", "locality": "Shivamogga HO", "city": "Shivamogga", "lat": 13.9299, "lng": 75.5681},

    # --- Andhra Pradesh ---
    "515001": {"pincode": "515001", "locality": "Anantapur HO", "city": "Anantapur", "lat": 14.6819, "lng": 77.6006},
    "518001": {"pincode": "518001", "locality": "Kurnool HO", "city": "Kurnool", "lat": 15.8281, "lng": 78.0373},
    "517501": {"pincode": "517501", "locality": "Tirupati HO", "city": "Tirupati", "lat": 13.6288, "lng": 79.4192},
    "520001": {"pincode": "520001", "locality": "Vijayawada HO", "city": "Vijayawada", "lat": 16.5062, "lng": 80.6480},
    "522001": {"pincode": "522001", "locality": "Guntur HO", "city": "Guntur", "lat": 16.3067, "lng": 80.4365},
    "524001": {"pincode": "524001", "locality": "Nellore HO", "city": "Nellore", "lat": 14.4426, "lng": 79.9865},
    "530001": {"pincode": "530001", "locality": "Visakhapatnam HO", "city": "Visakhapatnam", "lat": 17.7231, "lng": 83.3013},

    # --- Telangana ---
    "500001": {"pincode": "500001", "locality": "Hyderabad GPO", "city": "Hyderabad", "lat": 17.3850, "lng": 78.4867},
    "506001": {"pincode": "506001", "locality": "Warangal HO", "city": "Warangal", "lat": 17.9689, "lng": 79.5941},
    "503001": {"pincode": "503001", "locality": "Nizamabad HO", "city": "Nizamabad", "lat": 18.6725, "lng": 78.0941},
    "505001": {"pincode": "505001", "locality": "Karimnagar HO", "city": "Karimnagar", "lat": 18.4386, "lng": 79.1288},

    # --- Tamil Nadu & Puducherry ---
    "600001": {"pincode": "600001", "locality": "Chennai GPO / George Town", "city": "Chennai", "lat": 13.0878, "lng": 80.2785},
    "605001": {"pincode": "605001", "locality": "Puducherry HO", "city": "Puducherry", "lat": 11.9416, "lng": 79.8083},
    "620001": {"pincode": "620001", "locality": "Tiruchirappalli HO", "city": "Tiruchirappalli", "lat": 10.7905, "lng": 78.7047},
    "625001": {"pincode": "625001", "locality": "Madurai HO", "city": "Madurai", "lat": 9.9252, "lng": 78.1198},
    "627001": {"pincode": "627001", "locality": "Tirunelveli HO", "city": "Tirunelveli", "lat": 8.7139, "lng": 77.7567},
    "632001": {"pincode": "632001", "locality": "Vellore HO", "city": "Vellore", "lat": 12.9165, "lng": 79.1325},
    "636001": {"pincode": "636001", "locality": "Salem HO", "city": "Salem", "lat": 11.6643, "lng": 78.1460},
    "641001": {"pincode": "641001", "locality": "Coimbatore HO", "city": "Coimbatore", "lat": 11.0168, "lng": 76.9558},

    # --- Kerala & Lakshadweep ---
    "695001": {"pincode": "695001", "locality": "Thiruvananthapuram GPO", "city": "Thiruvananthapuram", "lat": 8.5241, "lng": 76.9366},
    "673001": {"pincode": "673001", "locality": "Kozhikode HO", "city": "Kozhikode", "lat": 11.2588, "lng": 75.7804},
    "680001": {"pincode": "680001", "locality": "Thrissur HO", "city": "Thrissur", "lat": 10.5276, "lng": 76.2144},
    "691001": {"pincode": "691001", "locality": "Kollam HO", "city": "Kollam", "lat": 8.8932, "lng": 76.6141},
    "682555": {"pincode": "682555", "locality": "Kavaratti SO", "city": "Kavaratti", "lat": 10.5667, "lng": 72.6417},

    # --- Maharashtra & Goa ---
    "400001": {"pincode": "400001", "locality": "Fort / Mumbai GPO", "city": "Mumbai", "lat": 18.9388, "lng": 72.8354},
    "400601": {"pincode": "400601", "locality": "Thane HO", "city": "Thane", "lat": 19.2183, "lng": 72.9781},
    "400703": {"pincode": "400703", "locality": "Vashi", "city": "Navi Mumbai", "lat": 19.0330, "lng": 73.0297},
    "413001": {"pincode": "413001", "locality": "Solapur HO", "city": "Solapur", "lat": 17.6599, "lng": 75.9064},
    "422001": {"pincode": "422001", "locality": "Nashik HO", "city": "Nashik", "lat": 19.9975, "lng": 73.7898},
    "431001": {"pincode": "431001", "locality": "Chhatrapati Sambhaji Nagar HO", "city": "Chhatrapati Sambhaji Nagar", "lat": 19.8762, "lng": 75.3433},
    "440001": {"pincode": "440001", "locality": "Nagpur GPO", "city": "Nagpur", "lat": 21.1458, "lng": 79.0882},
    "403001": {"pincode": "403001", "locality": "Panaji HO", "city": "Panaji", "lat": 15.4909, "lng": 73.8278},
    "403601": {"pincode": "403601", "locality": "Margao HO", "city": "Margao", "lat": 15.2832, "lng": 73.9862},

    # --- Gujarat & Daman/Diu/Dadra ---
    "380001": {"pincode": "380001", "locality": "Ahmedabad GPO", "city": "Ahmedabad", "lat": 23.0225, "lng": 72.5714},
    "382010": {"pincode": "382010", "locality": "Gandhinagar Sector 10", "city": "Gandhinagar", "lat": 23.2156, "lng": 72.6369},
    "390001": {"pincode": "390001", "locality": "Vadodara HO", "city": "Vadodara", "lat": 22.3072, "lng": 73.1812},
    "395001": {"pincode": "395001", "locality": "Surat HO", "city": "Surat", "lat": 21.1702, "lng": 72.8311},
    "360001": {"pincode": "360001", "locality": "Rajkot HO", "city": "Rajkot", "lat": 22.3039, "lng": 70.8022},
    "396210": {"pincode": "396210", "locality": "Daman HO", "city": "Daman", "lat": 20.3974, "lng": 72.8328},
    "396230": {"pincode": "396230", "locality": "Silvassa HO", "city": "Silvassa", "lat": 20.2763, "lng": 73.0083},

    # --- Madhya Pradesh & Chhattisgarh ---
    "462001": {"pincode": "462001", "locality": "Bhopal GPO", "city": "Bhopal", "lat": 23.2599, "lng": 77.4126},
    "452001": {"pincode": "452001", "locality": "Indore GPO", "city": "Indore", "lat": 22.7196, "lng": 75.8577},
    "474001": {"pincode": "474001", "locality": "Gwalior HO", "city": "Gwalior", "lat": 26.2183, "lng": 78.1828},
    "482001": {"pincode": "482001", "locality": "Jabalpur HO", "city": "Jabalpur", "lat": 23.1815, "lng": 79.9864},
    "456001": {"pincode": "456001", "locality": "Ujjain HO", "city": "Ujjain", "lat": 23.1765, "lng": 75.7885},
    "492001": {"pincode": "492001", "locality": "Raipur GPO", "city": "Raipur", "lat": 21.2514, "lng": 81.6296},
    "495001": {"pincode": "495001", "locality": "Bilaspur HO", "city": "Bilaspur", "lat": 22.0797, "lng": 82.1409},
    "490001": {"pincode": "490001", "locality": "Bhilai HO", "city": "Bhilai", "lat": 21.2167, "lng": 81.4333},

    # --- Rajasthan ---
    "305001": {"pincode": "305001", "locality": "Ajmer HO", "city": "Ajmer", "lat": 26.4499, "lng": 74.6399},
    "313001": {"pincode": "313001", "locality": "Udaipur HO", "city": "Udaipur", "lat": 24.5854, "lng": 73.7125},
    "324001": {"pincode": "324001", "locality": "Kota HO", "city": "Kota", "lat": 25.2138, "lng": 75.8648},
    "334001": {"pincode": "334001", "locality": "Bikaner HO", "city": "Bikaner", "lat": 28.0229, "lng": 73.3119},
    "342001": {"pincode": "342001", "locality": "Jodhpur HO", "city": "Jodhpur", "lat": 26.2389, "lng": 73.0243},

    # --- Delhi, Haryana, Punjab & Chandigarh ---
    "110001": {"pincode": "110001", "locality": "Connaught Place / New Delhi GPO", "city": "Delhi", "lat": 28.6315, "lng": 77.2167},
    "121001": {"pincode": "121001", "locality": "Faridabad NIT", "city": "Faridabad", "lat": 28.4089, "lng": 77.3178},
    "122001": {"pincode": "122001", "locality": "Gurugram HO", "city": "Gurugram", "lat": 28.4595, "lng": 77.0266},
    "132103": {"pincode": "132103", "locality": "Panipat HO", "city": "Panipat", "lat": 29.3909, "lng": 76.9635},
    "133001": {"pincode": "133001", "locality": "Ambala Cantt HO", "city": "Ambala", "lat": 30.3782, "lng": 76.7767},
    "141001": {"pincode": "141001", "locality": "Ludhiana HO", "city": "Ludhiana", "lat": 30.9010, "lng": 75.8573},
    "143001": {"pincode": "143001", "locality": "Amritsar GPO", "city": "Amritsar", "lat": 31.6340, "lng": 74.8723},
    "144001": {"pincode": "144001", "locality": "Jalandhar City HO", "city": "Jalandhar", "lat": 31.3260, "lng": 75.5762},
    "147001": {"pincode": "147001", "locality": "Patiala HO", "city": "Patiala", "lat": 30.3398, "lng": 76.3869},
    "151001": {"pincode": "151001", "locality": "Bathinda HO", "city": "Bathinda", "lat": 30.2110, "lng": 74.9455},
    "160017": {"pincode": "160017", "locality": "Chandigarh GPO", "city": "Chandigarh", "lat": 30.7333, "lng": 76.7794},

    # --- Himachal Pradesh, Jammu & Kashmir, Ladakh, Uttarakhand ---
    "171001": {"pincode": "171001", "locality": "Shimla GPO", "city": "Shimla", "lat": 31.1048, "lng": 77.1734},
    "175001": {"pincode": "175001", "locality": "Mandi HO", "city": "Mandi", "lat": 31.7087, "lng": 76.9320},
    "176215": {"pincode": "176215", "locality": "Dharamshala HO", "city": "Dharamshala", "lat": 32.2190, "lng": 76.3234},
    "180001": {"pincode": "180001", "locality": "Jammu GPO", "city": "Jammu", "lat": 32.7266, "lng": 74.8570},
    "190001": {"pincode": "190001", "locality": "Srinagar GPO", "city": "Srinagar", "lat": 34.0837, "lng": 74.7973},
    "194101": {"pincode": "194101", "locality": "Leh HO", "city": "Leh", "lat": 34.1526, "lng": 77.5771},
    "248001": {"pincode": "248001", "locality": "Dehradun GPO", "city": "Dehradun", "lat": 30.3165, "lng": 78.0322},
    "249401": {"pincode": "249401", "locality": "Haridwar HO", "city": "Haridwar", "lat": 29.9457, "lng": 78.1642},
    "263001": {"pincode": "263001", "locality": "Nainital HO", "city": "Nainital", "lat": 29.3919, "lng": 79.4542},
    "263139": {"pincode": "263139", "locality": "Haldwani HO", "city": "Haldwani", "lat": 29.2183, "lng": 79.5130},

    # --- Uttar Pradesh ---
    "201001": {"pincode": "201001", "locality": "Ghaziabad HO", "city": "Ghaziabad", "lat": 28.6692, "lng": 77.4538},
    "201301": {"pincode": "201301", "locality": "Noida Sector 1", "city": "Noida", "lat": 28.5355, "lng": 77.3910},
    "202001": {"pincode": "202001", "locality": "Aligarh HO", "city": "Aligarh", "lat": 27.8974, "lng": 78.0880},
    "208001": {"pincode": "208001", "locality": "Kanpur HO", "city": "Kanpur", "lat": 26.4499, "lng": 80.3319},
    "211001": {"pincode": "211001", "locality": "Prayagraj HO", "city": "Prayagraj", "lat": 25.4358, "lng": 81.8463},
    "221001": {"pincode": "221001", "locality": "Varanasi Cantt HO", "city": "Varanasi", "lat": 25.3176, "lng": 82.9739},
    "226001": {"pincode": "226001", "locality": "Lucknow GPO", "city": "Lucknow", "lat": 26.8467, "lng": 80.9462},
    "243001": {"pincode": "243001", "locality": "Bareilly HO", "city": "Bareilly", "lat": 28.3670, "lng": 79.4304},
    "250001": {"pincode": "250001", "locality": "Meerut Cantt HO", "city": "Meerut", "lat": 28.9845, "lng": 77.7064},
    "273001": {"pincode": "273001", "locality": "Gorakhpur HO", "city": "Gorakhpur", "lat": 26.7606, "lng": 83.3732},
    "282001": {"pincode": "282001", "locality": "Agra Fort HO", "city": "Agra", "lat": 27.1767, "lng": 78.0081},

    # --- Bihar & Jharkhand ---
    "800001": {"pincode": "800001", "locality": "Patna GPO", "city": "Patna", "lat": 25.5941, "lng": 85.1376},
    "812001": {"pincode": "812001", "locality": "Bhagalpur HO", "city": "Bhagalpur", "lat": 25.2425, "lng": 86.9842},
    "823001": {"pincode": "823001", "locality": "Gaya HO", "city": "Gaya", "lat": 24.7914, "lng": 85.0002},
    "826001": {"pincode": "826001", "locality": "Dhanbad HO", "city": "Dhanbad", "lat": 23.7957, "lng": 86.4304},
    "831001": {"pincode": "831001", "locality": "Jamshedpur HO", "city": "Jamshedpur", "lat": 22.8046, "lng": 86.2029},
    "834001": {"pincode": "834001", "locality": "Ranchi GPO", "city": "Ranchi", "lat": 23.3441, "lng": 85.3096},
    "842001": {"pincode": "842001", "locality": "Muzaffarpur HO", "city": "Muzaffarpur", "lat": 26.1209, "lng": 85.3647},

    # --- West Bengal, Odisha, Sikkim & Andaman & Nicobar ---
    "700001": {"pincode": "700001", "locality": "BBD Bagh / Kolkata GPO", "city": "Kolkata", "lat": 22.5726, "lng": 88.3511},
    "711101": {"pincode": "711101", "locality": "Howrah HO", "city": "Howrah", "lat": 22.5958, "lng": 88.2636},
    "713201": {"pincode": "713201", "locality": "Durgapur HO", "city": "Durgapur", "lat": 23.5204, "lng": 87.3119},
    "713301": {"pincode": "713301", "locality": "Asansol HO", "city": "Asansol", "lat": 23.6739, "lng": 86.9524},
    "721301": {"pincode": "721301", "locality": "Kharagpur Technology", "city": "Kharagpur", "lat": 22.3460, "lng": 87.2320},
    "734001": {"pincode": "734001", "locality": "Siliguri HO", "city": "Siliguri", "lat": 26.7271, "lng": 88.3953},
    "737101": {"pincode": "737101", "locality": "Gangtok HO", "city": "Gangtok", "lat": 27.3389, "lng": 88.6065},
    "744101": {"pincode": "744101", "locality": "Port Blair HO", "city": "Port Blair", "lat": 11.6234, "lng": 92.7265},
    "751001": {"pincode": "751001", "locality": "Bhubaneswar GPO", "city": "Bhubaneswar", "lat": 20.2961, "lng": 85.8245},
    "753001": {"pincode": "753001", "locality": "Cuttack GPO", "city": "Cuttack", "lat": 20.4625, "lng": 85.8828},
    "760001": {"pincode": "760001", "locality": "Berhampur HO", "city": "Berhampur", "lat": 19.3149, "lng": 84.7941},
    "769001": {"pincode": "769001", "locality": "Rourkela HO", "city": "Rourkela", "lat": 22.2604, "lng": 84.8536},

    # --- North Eastern States ---
    "781001": {"pincode": "781001", "locality": "Guwahati GPO", "city": "Guwahati", "lat": 26.1445, "lng": 91.7362},
    "786001": {"pincode": "786001", "locality": "Dibrugarh HO", "city": "Dibrugarh", "lat": 27.4728, "lng": 94.9120},
    "788001": {"pincode": "788001", "locality": "Silchar HO", "city": "Silchar", "lat": 24.8333, "lng": 92.7789},
    "791111": {"pincode": "791111", "locality": "Itanagar HO", "city": "Itanagar", "lat": 27.0844, "lng": 93.6053},
    "793001": {"pincode": "793001", "locality": "Shillong GPO", "city": "Shillong", "lat": 25.5788, "lng": 91.8933},
    "795001": {"pincode": "795001", "locality": "Imphal HO", "city": "Imphal", "lat": 24.8170, "lng": 93.9368},
    "796001": {"pincode": "796001", "locality": "Aizawl HO", "city": "Aizawl", "lat": 23.7271, "lng": 92.7176},
    "797001": {"pincode": "797001", "locality": "Kohima HO", "city": "Kohima", "lat": 25.6751, "lng": 94.1086},
    "797112": {"pincode": "797112", "locality": "Dimapur HO", "city": "Dimapur", "lat": 25.9068, "lng": 93.7274},
    "799001": {"pincode": "799001", "locality": "Agartala HO", "city": "Agartala", "lat": 23.8315, "lng": 91.2868},
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


def validate_all_coordinates() -> bool:
    """Verifies that all registered centroids strictly fall within the geographic bounds of India."""
    all_areas = get_all_mapped_areas()
    for pin, data in all_areas.items():
        lat = data["lat"]
        lng = data["lng"]
        if not (6.0 <= lat <= 37.5 and 68.0 <= lng <= 97.5):
            raise ValueError(f"Centroid for {pin} out of Indian bounding box: lat={lat}, lng={lng}")
    return True


def get_area_by_pincode(pincode: Optional[Any]) -> Optional[Dict[str, Any]]:
    """Legacy resolver for backward compatibility: checks Appendix B areas, aliases, and extended areas."""
    if pincode is None:
        return None
    p = str(pincode).strip()
    if p in APPENDIX_B_AREAS:
        return APPENDIX_B_AREAS[p]
    target_pin = PINCODE_ALIASES.get(p)
    if target_pin:
        primary = APPENDIX_B_AREAS.get(target_pin) or EXTENDED_AREAS.get(target_pin)
        if primary:
            base = primary.copy()
            base["pincode"] = p
            return base
    if p in EXTENDED_AREAS:
        return EXTENDED_AREAS[p]
    return None


def resolve_pincode_area(pincode: Optional[Any]) -> Optional[Dict[str, Any]]:
    """
    Comprehensive area resolver.
    - If format is invalid: returns None.
    - If mapped (Appendix B, Extended, or Alias): returns dict with exact coordinates and is_mapped=True.
    - If valid 6-digit pincode without registered coordinates: returns region info with lat=None, lng=None, is_mapped=False.
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


# Run sanity check upon import to guarantee coordinate integrity
validate_all_coordinates()
