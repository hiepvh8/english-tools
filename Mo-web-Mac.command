#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  printf 'Cần Python 3 để mở localhost. Bạn có thể đọc bài bằng dist/index.html.\n'
  read -r -p 'Nhấn Enter để đóng. '
  exit 1
fi
python3 start.py --open
result=$?
if [ "$result" -ne 0 ]; then
  read -r -p 'Nhấn Enter để đóng. '
fi
exit "$result"
