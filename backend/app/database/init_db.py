from sqlalchemy.orm import Session
from app.database.base import Base
from app.database.session import engine, SessionLocal
from app.models.user import User
from app.models.device import Device, DeviceService, DeviceSNMPConfig
from app.core.security import get_password_hash
from app.core.logging import logger

def init_db(db: Session) -> None:
    # Create all tables
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified/created successfully.")

    # Seed Admin User if not present
    admin = db.query(User).filter(User.username == "admin").first()
    if not admin:
        admin = User(
            username="admin",
            email="admin@netopswatch.local",
            hashed_password=get_password_hash("Admin@NetOps123"),
            role="ADMIN",
            is_active=True
        )
        db.add(admin)
        logger.info("Seeded default administrator user: admin")

    # Seed Operator User
    operator = db.query(User).filter(User.username == "operator1").first()
    if not operator:
        operator = User(
            username="operator1",
            email="operator@netopswatch.local",
            hashed_password=get_password_hash("Operator@NetOps123"),
            role="OPERATOR",
            is_active=True
        )
        db.add(operator)
        logger.info("Seeded default operator user: operator1")

    # Seed Viewer User
    viewer = db.query(User).filter(User.username == "viewer1").first()
    if not viewer:
        viewer = User(
            username="viewer1",
            email="viewer@netopswatch.local",
            hashed_password=get_password_hash("Viewer@NetOps123"),
            role="VIEWER",
            is_active=True
        )
        db.add(viewer)
        logger.info("Seeded default viewer user: viewer1")

    db.commit()

    # Seed initial realistic network topology devices if empty
    device_count = db.query(Device).count()
    if device_count == 0:
        logger.info("Seeding initial network infrastructure devices...")

        # 1. Edge Gateway / Router
        gw = Device(
            name="Edge-Router-01",
            hostname="gw.netops.internal",
            ip_address="1.1.1.1",  # Cloudflare DNS / reliable test gateway
            device_type="ROUTER",
            location="HQ Edge Tier",
            description="Core border gateway router handling WAN routing and BGP transit",
            monitoring_enabled=True,
            check_interval=30,
            status="UP"
        )
        db.add(gw)
        db.flush()

        # Gateway services
        db.add(DeviceService(
            device_id=gw.id,
            service_type="TCP_PORT",
            port=53,
            name="DNS Service",
            is_monitored=True
        ))
        db.add(DeviceSNMPConfig(
            device_id=gw.id,
            enabled=False,
            version="2c",
            community="public",
            port=161
        ))

        # 2. Core Distribution Switch (connected to gw)
        switch = Device(
            name="Core-Switch-01",
            hostname="sw-core01.netops.internal",
            ip_address="8.8.8.8",  # Google Public DNS as reliable reachable host
            device_type="SWITCH",
            location="HQ Datacenter Row A",
            description="48-Port 10GbE Distribution switch connecting server racks",
            monitoring_enabled=True,
            check_interval=30,
            status="UP",
            parent_device_id=gw.id
        )
        db.add(switch)
        db.flush()

        db.add(DeviceService(
            device_id=switch.id,
            service_type="TCP_PORT",
            port=53,
            name="DNS-Port-53",
            is_monitored=True
        ))
        db.add(DeviceSNMPConfig(
            device_id=switch.id,
            enabled=False,
            version="2c",
            community="public",
            port=161
        ))

        # 3. Local Web & Application Server (localhost)
        app_srv = Device(
            name="App-Server-Prod01",
            hostname="app01.netops.internal",
            ip_address="127.0.0.1",
            device_type="SERVER",
            location="HQ Datacenter Row A Rack 2",
            description="Production application server hosting REST API and Web services",
            monitoring_enabled=True,
            check_interval=30,
            status="UP",
            parent_device_id=switch.id
        )
        db.add(app_srv)
        db.flush()

        db.add(DeviceService(
            device_id=app_srv.id,
            service_type="HTTP_ENDPOINT",
            url="http://127.0.0.1:8000/api/v1/health",
            name="FastAPI Health API",
            is_monitored=True
        ))
        db.add(DeviceService(
            device_id=app_srv.id,
            service_type="TCP_PORT",
            port=8000,
            name="FastAPI Port 8000",
            is_monitored=True
        ))

        # 4. Database Server
        db_srv = Device(
            name="DB-Cluster-Primary",
            hostname="db-pri01.netops.internal",
            ip_address="127.0.0.1",
            device_type="DB_SERVER",
            location="HQ Datacenter Row B Rack 1",
            description="PostgreSQL Database cluster primary node",
            monitoring_enabled=True,
            check_interval=30,
            status="UP",
            parent_device_id=switch.id
        )
        db.add(db_srv)
        db.flush()

        db.add(DeviceService(
            device_id=db_srv.id,
            service_type="TCP_PORT",
            port=5432,
            name="PostgreSQL Port 5432",
            is_monitored=True
        ))

        # 5. External API / Cloud Service
        ext_api = Device(
            name="Cloud-API-Gateway",
            hostname="api.github.com",
            ip_address="140.82.121.4",
            device_type="OTHER",
            location="US East Cloud Region",
            description="External cloud API endpoint for telemetry and integrations",
            monitoring_enabled=True,
            check_interval=30,
            status="UP",
            parent_device_id=gw.id
        )
        db.add(ext_api)
        db.flush()

        db.add(DeviceService(
            device_id=ext_api.id,
            service_type="HTTP_ENDPOINT",
            url="https://api.github.com",
            name="GitHub HTTPS API",
            is_monitored=True
        ))
        db.add(DeviceService(
            device_id=ext_api.id,
            service_type="TCP_PORT",
            port=443,
            name="HTTPS Port 443",
            is_monitored=True
        ))

        # 6. Branch Office Router (simulated degraded / offline target for testing)
        branch_gw = Device(
            name="Branch-Router-West",
            hostname="branch-west.netops.internal",
            ip_address="192.0.2.1",  # RFC 5737 TEST-NET-1 (unroutable/unreachable)
            device_type="ROUTER",
            location="West Coast Branch",
            description="Remote branch office VPN router (unreachable endpoint for testing alerts/incidents)",
            monitoring_enabled=True,
            check_interval=60,
            status="DOWN",
            consecutive_failures=3,
            parent_device_id=gw.id
        )
        db.add(branch_gw)
        db.flush()

        db.add(DeviceService(
            device_id=branch_gw.id,
            service_type="TCP_PORT",
            port=443,
            name="Branch VPN Port",
            is_monitored=True,
            status="DOWN"
        ))

        db.commit()
        logger.info("Successfully seeded 6 realistic network infrastructure devices with monitored services.")
