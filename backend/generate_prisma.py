import os
import subprocess
import sys

def generate_prisma_client():
    """Generate the Prisma client from the schema.prisma file."""
    try:
        # Run prisma db push with --accept-data-loss flag
        subprocess.run(["prisma", "db", "push", "--accept-data-loss"], check=True)
        print("✅ Database schema synchronized successfully")
        
        # Run prisma generate to generate the client
        subprocess.run(["prisma", "generate"], check=True)
        print("✅ Prisma client generated successfully")
        
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Error generating Prisma client: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

if __name__ == "__main__":
    success = generate_prisma_client()
    sys.exit(0 if success else 1)
