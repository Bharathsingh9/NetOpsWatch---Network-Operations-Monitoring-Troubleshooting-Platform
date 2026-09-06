import asyncio
from sqlalchemy.orm import Session
from app.database.session import SessionLocal
from app.models.device import Device
from app.services.monitoring_service import check_device
from app.core.config import settings
from app.core.logging import logger

_scheduler_task: asyncio.Task = None
_is_running: bool = False

async def _monitoring_loop():
    logger.info(f"NetOpsWatch background monitoring scheduler started (Interval: {settings.DEFAULT_MONITORING_INTERVAL_SECONDS}s).")
    while _is_running:
        db: Session = SessionLocal()
        try:
            # Query devices with monitoring enabled
            devices = db.query(Device).filter(Device.monitoring_enabled == True).all()
            if devices:
                logger.debug(f"Starting scheduled monitoring poll for {len(devices)} devices...")
                # Run device checks concurrently in chunks to prevent network saturation
                chunk_size = 10
                for i in range(0, len(devices), chunk_size):
                    chunk = devices[i:i + chunk_size]
                    tasks = [check_device(db, dev) for dev in chunk]
                    await asyncio.gather(*tasks, return_exceptions=True)
                logger.debug(f"Completed scheduled monitoring poll cycle.")
        except Exception as e:
            logger.error(f"Unhandled error in monitoring scheduler loop: {str(e)}")
        finally:
            db.close()

        try:
            await asyncio.sleep(settings.DEFAULT_MONITORING_INTERVAL_SECONDS)
        except asyncio.CancelledError:
            break

def start_monitoring_scheduler():
    global _scheduler_task, _is_running
    if not _is_running:
        _is_running = True
        loop = asyncio.get_event_loop()
        _scheduler_task = loop.create_task(_monitoring_loop())

def stop_monitoring_scheduler():
    global _scheduler_task, _is_running
    _is_running = False
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()
        logger.info("NetOpsWatch background monitoring scheduler stopped.")
