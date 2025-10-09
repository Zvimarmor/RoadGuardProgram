-- CreateIndex
CREATE INDEX "Shift_periodId_guardId_idx" ON "Shift"("periodId", "guardId");

-- CreateIndex
CREATE INDEX "Shift_periodId_endTime_idx" ON "Shift"("periodId", "endTime");

-- CreateIndex
CREATE INDEX "Shift_periodId_startTime_endTime_idx" ON "Shift"("periodId", "startTime", "endTime");
