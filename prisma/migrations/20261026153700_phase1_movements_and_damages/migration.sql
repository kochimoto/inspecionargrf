-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('ENTRY', 'EXIT');

-- CreateEnum
CREATE TYPE "MovementReason" AS ENUM ('PURCHASE', 'CONSIGNMENT', 'TRADE_IN', 'SALE', 'RETURN', 'WORKSHOP', 'OTHER');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('OK', 'ALERT', 'DEFECT');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DamageType" AS ENUM ('SCRATCH', 'DENT', 'CRACK', 'MISSING_PART', 'OTHER');

-- CreateEnum
CREATE TYPE "PhotoAngle" AS ENUM ('FRONT', 'REAR', 'LEFT', 'RIGHT', 'FRONT_LEFT', 'FRONT_RIGHT', 'REAR_LEFT', 'REAR_RIGHT', 'DASHBOARD', 'INTERIOR', 'TRUNK', 'CHASSIS_PLATE', 'EXTRA');

-- DropForeignKey (to allow making inspectionItemId nullable)
ALTER TABLE "Photo" DROP CONSTRAINT "Photo_inspectionItemId_fkey";

-- AlterTable Inspection (in-place conversion of status without DROP COLUMN)
ALTER TABLE "Inspection"
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "movementId" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ALTER COLUMN   "status" DROP DEFAULT,
ALTER COLUMN   "status" TYPE "InspectionStatus" USING ("status"::text::"InspectionStatus"),
ALTER COLUMN   "status" SET DEFAULT 'PENDING';

-- AlterTable InspectionItem (in-place conversion of status without DROP COLUMN)
ALTER TABLE "InspectionItem"
ALTER COLUMN   "status" TYPE "ItemStatus" USING ("status"::text::"ItemStatus");

-- AlterTable Photo
ALTER TABLE "Photo"
ADD COLUMN     "angle" "PhotoAngle" NOT NULL DEFAULT 'EXTRA',
ADD COLUMN     "movementId" TEXT,
ALTER COLUMN   "inspectionItemId" DROP NOT NULL;

-- AlterTable Vehicle
ALTER TABLE "Vehicle"
ADD COLUMN     "chassis" TEXT,
ADD COLUMN     "color" TEXT,
ADD COLUMN     "renavam" TEXT;

-- CreateTable Movement
CREATE TABLE "Movement" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "reason" "MovementReason" NOT NULL,
    "km" INTEGER NOT NULL,
    "fuelLevel" INTEGER NOT NULL DEFAULT 0,
    "personName" TEXT NOT NULL,
    "personDoc" TEXT,
    "signature" TEXT,
    "notes" TEXT,
    "inspectorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable Damage
CREATE TABLE "Damage" (
    "id" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "type" "DamageType" NOT NULL,
    "notes" TEXT,
    "photoId" TEXT,

    CONSTRAINT "Damage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Movement_vehicleId_createdAt_idx" ON "Movement"("vehicleId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Inspection_movementId_key" ON "Inspection"("movementId");

-- CreateIndex
CREATE INDEX "Vehicle_licensePlate_idx" ON "Vehicle"("licensePlate");

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Damage" ADD CONSTRAINT "Damage_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "Movement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Damage" ADD CONSTRAINT "Damage_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "Movement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_inspectionItemId_fkey" FOREIGN KEY ("inspectionItemId") REFERENCES "InspectionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "Movement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
