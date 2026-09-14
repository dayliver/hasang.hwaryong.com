# 정적 미사 자료

브라우저 목록에서 미사 행의 **보내기**로 받은 JSON(미사 하나)을
여기에 `hasang-bundle.json` 이름으로 두면 됩니다.

- 경로: `public/data/hasang-bundle.json` → `/data/hasang-bundle.json`
- 로컬에 저장된 미사가 없을 때만 이 파일로 자동 시드합니다.
- 파일 하나에 미사 여러 개를 넣어도 됩니다(`masses` 배열).
