ALTER TABLE "bookmakers" ADD COLUMN "transport" TEXT default '';
ALTER TABLE "bookmakers" ADD COLUMN "last_success_at" TEXT default '';
ALTER TABLE "bookmakers" ADD COLUMN "failure_streak" REAL default 0;
