/*
  Warnings:

  - Added the required column `privateKey` to the `Wallet` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "privateKey" VARCHAR(100) NOT NULL;
