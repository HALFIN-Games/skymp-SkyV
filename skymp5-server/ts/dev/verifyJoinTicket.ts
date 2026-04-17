import { JoinTicketVerifier } from "../utils/joinTicket";

const jwt = process.argv[2];
if (!jwt) {
  console.error("Usage: node verifyJoinTicket.js <jwt>");
  process.exit(2);
}

const v = JoinTicketVerifier.fromEnvOrDefaultFile();
const now = Math.floor(Date.now() / 1000);
const claims = v.verify(jwt, now);
console.log(JSON.stringify(claims, null, 2));

