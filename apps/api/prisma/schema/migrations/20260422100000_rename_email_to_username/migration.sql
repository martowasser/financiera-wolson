-- Rename User.email to User.username
ALTER TABLE "User" RENAME COLUMN "email" TO "username";

-- Rename the unique index
ALTER INDEX "User_email_key" RENAME TO "User_username_key";
