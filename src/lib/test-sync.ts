import "dotenv/config";
import { runSync } from "./sync";

async function main() {
  console.log("=== 채널톡 → 세일즈맵 동기화 테스트 ===\n");
  const result = await runSync(1); // HTML 노트 테스트 1건
  console.log("\n=== 결과 ===");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
