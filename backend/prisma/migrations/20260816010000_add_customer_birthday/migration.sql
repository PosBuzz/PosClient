-- Customer date of birth, used for birthday greetings and offers.
-- Date only: the time part of a birthday is never meaningful.
ALTER TABLE "customers" ADD COLUMN "birthday" DATE;
