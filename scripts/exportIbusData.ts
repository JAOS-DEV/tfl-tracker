import { main } from "@/lib/ibus/exportIbusData";

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
