import { DEFAULT_BUSINESS_TIMEZONE } from './common/utils/business-time.util';

// Must be imported before anything creates Dates: every "which day is it"
// computation uses local time, so local time has to be the shop's time zone,
// not the container's (UTC).
process.env.TZ = process.env.BUSINESS_TIMEZONE || DEFAULT_BUSINESS_TIMEZONE;
