import re
from functools import lru_cache
from typing import List, Dict, Any

# Define Keyword Dictionaries with Severity Scores (1-10)
# 10 = Critical (Immediate "Not Recommended")
# 7-9 = High
# 4-6 = Moderate
# 1-3 = Low

RISK_KEYWORDS = {
    # CRITICAL
    "war": 10,
    "invasion": 10,
    "armed conflict": 10,
    "martial law": 10,
    "coup": 10,
    "terrorist attack": 10,
    "embargo": 9,
    "sanction": 9,
    "blockade": 9,
    "piracy": 9,
    "missile": 9,
    
    # HIGH
    "riot": 8,
    "violent protest": 8,
    "kidnapping": 8,
    "hurricane": 8,
    "typhoon": 8,
    "earthquake": 8,
    "tsunami": 8,
    "state of emergency": 7,
    "border closure": 7,
    "port closure": 7,
    "cyber attack": 7,
    "high risk": 7,
    
    # MODERATE
    "strike": 6,
    "labour action": 6,
    "civil unrest": 6,
    "crisis": 5,
    "disruption": 4,
    "flood": 5,
    "storm warning": 5,
    "severe weather": 5,
    "political tension": 5,
    "corruption": 4,
    "delay": 4,
    "congestion": 4,
    "backlog": 4,
    "shortage": 4,
    "price spike": 4,
    
    # LOW
    "rain": 2,
    "snow": 2,
    "fog": 2,
    "maintenance": 2,
    "inspection": 1,
    "monitor": 1,
    "watch": 1,
    "uncertainty": 1
}

STATIC_RISK_PROFILES = {
    "Russia": ["sanctions", "conflict", "embargo", "high risk", "trade restrictions"],
    "Russian Federation": ["sanctions", "conflict", "embargo", "high risk", "trade restrictions"],
    "China": ["geopolitical tension", "trade war", "supply chain complexity"],
    "Iran": ["sanctions", "embargo", "geopolitical tension", "high risk"],
    "North Korea": ["sanctions", "embargo", "isolation", "critical risk"],
    "Syria": ["war", "conflict", "instability", "critical risk"],
    "Ukraine": ["war", "invasion", "conflict", "high risk"],
    "Yemen": ["war", "conflict", "crisis", "critical risk"],
    "Afghanistan": ["instability", "conflict", "high risk"],
    "Sudan": ["conflict", "civil unrest", "high risk"],
    "Somalia": ["piracy", "conflict", "high risk"],
    "Venezuela": ["crisis", "sanctions", "unrest", "high risk"],
    "Myanmar": ["coup", "conflict", "unrest", "high risk"],
    "Haiti": ["gang violence", "crisis", "unrest", "high risk"],
    "Israel": ["conflict", "geopolitical tension", "security risk"],
    "Lebanon": ["conflict", "instability", "economic crisis"],
    "Red Sea": ["missile", "drone attacks", "piracy", "disruption"]
}

def get_static_risk_keywords(location: str) -> str:
    """Returns static risk keywords for known high-risk locations."""
    if not location:
        return ""
    
    keywords = []
    for country, kws in STATIC_RISK_PROFILES.items():
        if country.lower() in location.lower():
            keywords.extend(kws)
            
    return " ".join(keywords)

NEGATION_TERMS = ["no ", "not ", "unlikely ", "avoided ", "prevention of ", "false ", "rumor of "]

def _clean_text(text: str) -> str:
    """Normalize text for analysis."""
    return text.lower().strip()

def _check_negation(text: str, index: int) -> bool:
    """Check if a keyword at `index` is preceded by a negation term."""
    # Look back up to 20 characters
    start = max(0, index - 20)
    preceding = text[start:index]
    for term in NEGATION_TERMS:
        if term in preceding:
            return True
    return False

KNOWN_CONFLICT_HOTSPOTS = {
    "ukraine", "russia", "syria", "yemen", "sudan", "somalia", "afghanistan",
    "myanmar", "israel", "lebanon", "gaza", "iran", "red sea", "haiti"
}

@lru_cache(maxsize=500)
def calculate_risk_score(text: str, target_location: str = "", from_location: str = "") -> Dict[str, Any]:
    """
    Analyzes text and returns a risk assessment dictionary.
    Incorporates authoritative corridor key point weights from routing_data.json (sanctions, landlocked, ports).
    Output keys: score (0-10), risk_level, reasons (list), recommendation, routing_data
    """
    clean_text = _clean_text(text)
    target_clean = (target_location or "").lower().strip()
    
    found_risks = []
    max_severity = 0
    total_severity = 0
    
    # 0. Check routing_data.json authoritative weights
    routing_data = None
    if target_location:
        try:
            from src.utils.routing_weight_engine import routing_weight_engine
            routing_data = routing_weight_engine.compute_routing_weights(from_location or target_location, target_location)
            
            if routing_data.get("sanctions_weight", 0.0) >= 0.8:
                max_severity = max(max_severity, 10)
                found_risks.append({
                    "keyword": "sanctions",
                    "severity": 10,
                    "context": "Active trade sanctions / embargo on corridor (routing_data.json)"
                })
            elif routing_data.get("landlocked_transit_weight", 0.0) >= 0.7:
                found_risks.append({
                    "keyword": "landlocked",
                    "severity": 4,
                    "context": "Landlocked inland feeder transit requirement (routing_data.json)"
                })
                if max_severity < 4:
                    max_severity = 4
        except Exception:
            pass
    
    for keyword, severity in RISK_KEYWORDS.items():
        # Match whole word / boundary only to eliminate substring false positives
        pattern = r'\b' + re.escape(keyword.lower()) + r'\b'
        match = re.search(pattern, clean_text)
        if match:
            idx = match.start()
            if _check_negation(clean_text, idx):
                continue
                
            effective_severity = severity
            context_label = f"Detected '{keyword}' (Severity: {severity})"

            # 1. Economic / trade war check (e.g., 'trade war', 'price war' is economic, not military severity 10)
            if keyword == "war" and re.search(r'\b(trade|price|tech|tariff|bidding|currency)\s+war\b', clean_text):
                effective_severity = 4
                context_label = "Detected 'trade/economic war' (Severity: 4)"

            # 2. External conflict ripple check (if war headline mentions another country while evaluating a safe hub)
            elif severity >= 8 and target_clean and target_clean not in KNOWN_CONFLICT_HOTSPOTS:
                for hs in KNOWN_CONFLICT_HOTSPOTS:
                    if hs in clean_text and target_clean != hs:
                        effective_severity = 4
                        context_label = f"Detected external regional tension ({hs}: '{keyword}')"
                        break

            found_risks.append({
                "keyword": keyword,
                "severity": effective_severity,
                "context": context_label
            })
            
            if effective_severity > max_severity:
                max_severity = effective_severity
            total_severity += effective_severity

    # Scoring Logic
    if not found_risks:
        return {
            "score": 1.5,
            "risk_level": "Low",
            "recommendation": "Recommended",
            "reasons": ["No critical risk signals detected; baseline operational corridor index."],
            "raw_matches": [],
            "routing_data": routing_data
        }
        
    density_score = min(3.0, len(found_risks) * 0.4)
    
    # If Max Severity is 10 (Critical war/armed conflict), score is 9.5 - 10.0
    if max_severity >= 10:
        final_score = 10.0
    elif max_severity >= 8:
        final_score = min(9.0, max_severity + (density_score * 0.3))
    elif max_severity >= 6:
        final_score = min(7.5, max_severity + (density_score * 0.3))
    else:
        final_score = max(1.5, min(5.5, max_severity * 0.8 + (density_score * 0.3)))
        
    final_score = round(final_score, 1)
    
    # Determine Level & Recommendation
    if final_score >= 7.5:
        risk_level = "High"
        recommendation = "Not Recommended"
    elif final_score >= 4.0:
        risk_level = "Moderate"
        recommendation = "Use with Caution"
    else:
        risk_level = "Low"
        recommendation = "Recommended"
        
    # Format Reasons
    found_risks.sort(key=lambda x: x['severity'], reverse=True)
    reasons = [r['context'] for r in found_risks[:5]]
    
    if len(found_risks) > 5:
        reasons.append(f"And {len(found_risks) - 5} other lower-level risk indicators.")

    return {
        "score": final_score,
        "risk_level": risk_level,
        "recommendation": recommendation,
        "reasons": reasons,
        "raw_matches": found_risks,
        "routing_data": routing_data
    }
