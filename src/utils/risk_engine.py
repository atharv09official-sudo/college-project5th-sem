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
    "crisis": 7,
    "disruption": 7,
    "high risk": 7,
    
    # MODERATE
    "strike": 6,
    "labour action": 6,
    "civil unrest": 6,
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

@lru_cache(maxsize=500)
def calculate_risk_score(text: str) -> Dict[str, Any]:
    """
    Analyzes text and returns a risk assessment dictionary.
    Output keys: score (0-10), risk_level, reasons (list), recommendation
    """
    clean_text = _clean_text(text)
    
    found_risks = []
    max_severity = 0
    total_severity = 0
    
    for keyword, severity in RISK_KEYWORDS.items():
        if keyword in clean_text:
            # Find index to check negation
            idx = clean_text.find(keyword)
            if _check_negation(clean_text, idx):
                continue
                
            found_risks.append({
                "keyword": keyword,
                "severity": severity,
                "context": f"Detected '{keyword}' (Severity: {severity})"
            })
            
            if severity > max_severity:
                max_severity = severity
            total_severity += severity

    # Scoring Logic
    # Base score is heavily influenced by the highest severity found.
    # We also add a small factor for the NUMBER of risks found (density).
    
    if not found_risks:
        return {
            "score": 0.5,
            "risk_level": "Low",
            "recommendation": "Recommended",
            "reasons": ["No major risk signals detected; baseline operational risk only."]
        }
        
    # Formula: Max Severity (70% weight) + Density (30% weight)
    # Density: min(3.0, count * 0.5)
    density_score = min(3.0, len(found_risks) * 0.5)
    
    # If Max Severity is 10 (Critical), score is automatically 10.
    if max_severity >= 10:
        final_score = 10.0
    else:
        final_score = max_severity + (density_score * 0.5) # Add a bit, but don't overinflate
        final_score = min(9.9, final_score)
        
    final_score = round(final_score, 1)
    
    # Determine Level & Recommendation
    if final_score >= 8.0:
        risk_level = "High"
        recommendation = "Not Recommended"
    elif final_score >= 4.0:
        risk_level = "Moderate"
        recommendation = "Use with Caution"
    else:
        risk_level = "Low"
        recommendation = "Recommended"
        
    # Format Reasons
    # Sort by severity desc
    found_risks.sort(key=lambda x: x['severity'], reverse=True)
    reasons = [r['context'] for r in found_risks[:5]] # Top 5 reasons
    
    if len(found_risks) > 5:
        reasons.append(f"And {len(found_risks) - 5} other lower-level risk indicators.")

    return {
        "score": final_score,
        "risk_level": risk_level,
        "recommendation": recommendation,
        "reasons": reasons,
        "raw_matches": found_risks
    }
