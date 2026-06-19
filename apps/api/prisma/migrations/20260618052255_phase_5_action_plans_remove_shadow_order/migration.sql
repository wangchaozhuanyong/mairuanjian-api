/*
  Warnings:

  - You are about to drop the column `appleOrderId` on the `apple_account_action_plan_items` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "apple_account_action_plan_items" DROP CONSTRAINT "apple_account_action_plan_items_appleOrderId_fkey";

-- AlterTable
ALTER TABLE "apple_account_action_plan_items" DROP COLUMN "appleOrderId";
