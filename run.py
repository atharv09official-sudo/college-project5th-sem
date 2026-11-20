import uvicorn
import os

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    print(f"Starting HETVAYA FlowGrid Production Server on http://localhost:{port}")
    print(f"Interactive Swagger API Docs: http://localhost:{port}/docs")
    print(f"Plan Generator & Allocations: http://localhost:{port}/plan-generator")
    print(f"Inventory Health & DOS: http://localhost:{port}/inventory-health")
    print(f"Kirana POS Portal: http://localhost:{port}/kirana-pos")
    print(f"Road Risk & Ghats: http://localhost:{port}/road-risk")
    print(f"Master Data Import Studio: http://localhost:{port}/import-studio")
    uvicorn.run("app.main:app", host=host, port=port, reload=False)
