import os
import sys

# Add backend directory to sys.path
backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend')
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

if __name__ == '__main__':
    import uvicorn
    uvicorn.run('app.main:app', host='127.0.0.1', port=8000, reload=True, app_dir=backend_dir)
