# Tiếng Anh từ nền tảng đến IELTS 6.0

Website tự học tiếng Việt trong 36 tuần. Học 90 phút từ thứ Hai đến thứ Sáu và 150 phút thứ Bảy. Chủ nhật có thể nghỉ hoặc học bù.

## Mở trên MacBook

1. Tải ZIP của phiên bản cần dùng từ GitHub rồi giải nén toàn bộ thư mục.
2. Bấm đúp **Mo-web-Mac.command**. Cần Python 3. Giữ cửa sổ Terminal mở trong lúc học.
3. Trình duyệt sẽ mở [http://localhost:4173/](http://localhost:4173/). Ở **Tổng quan**, mở **Làm bài đầu vào M00**, rồi học **U01**.

Nếu trình mở bằng Finder gặp lỗi, mở Terminal tại thư mục vừa giải nén rồi chạy:

~~~sh
python3 start.py --open
~~~

Có thể chạy `python3 start.py` rồi mở địa chỉ trong trình duyệt. Trên Windows, dùng `py -3 start.py`. Nhấn Control+C trong Terminal để dừng. Khi cần đổi cổng, chạy `python3 start.py --port 4174` và dùng địa chỉ mới in ra.

Bài học và MP3 nằm trong thư mục, nên sau khi tải về bạn có thể chạy mà không cần mạng. Bạn cũng có thể mở trực tiếp `dist/index.html` để đọc bài và nghe. Trình duyệt có thể hạn chế lưu tiến độ hoặc thu âm ở chế độ mở tệp. Các đề và trang nguồn bên ngoài cần mạng.

## Tài khoản và học trên nhiều thiết bị

- Chọn **Tài khoản → Tạo tài khoản mới**. Mỗi người dùng tên đăng nhập và mật khẩu riêng. **Đăng xuất** khi dùng chung trình duyệt.
- Khi đăng nhập, tiến độ, bản nháp, điểm và sổ lỗi được đồng bộ với máy chủ. Chờ trạng thái **Đã đồng bộ** trước khi đóng trang hoặc chuyển thiết bị. Bản ghi âm lưu riêng theo tài khoản trong trình duyệt. Dùng bản sao lưu JSON nếu muốn chuyển cả bản ghi.
- Bài học khách vẫn mở như trước. Để chuyển tiến độ khách sang tài khoản, tải bản sao lưu ở **Cài đặt** trước khi đăng nhập, rồi nhập lại sau khi đăng nhập.
- Máy chủ lưu tài khoản trong `.ielts-data/accounts.sqlite3`. Khi nâng cấp ZIP, dừng máy chủ và giữ lại thư mục `.ielts-data`, hoặc chạy các phiên bản với cùng đường dẫn `--data-dir`. Sao lưu thư mục này khi máy chủ đã dừng.

### Cho người học truy cập từ máy khác

`localhost` phục vụ trình duyệt trên máy đang chạy Python. Để cùng học từ nhiều thiết bị hoặc địa điểm, dùng một máy chủ chung với tên miền HTTPS. Đặt ứng dụng sau reverse proxy kết thúc TLS và chuyển tiếp nguyên tiêu đề `Host`. Trỏ proxy tới `127.0.0.1:4173` và chạy:

~~~sh
python3 start.py --public-origin https://hoc.example.com --data-dir /duong-dan/ielts-data
~~~

Thay tên miền và đường dẫn bằng cấu hình của máy chủ. Người học đăng ký trên đúng địa chỉ HTTPS đó. Chạy Python dưới tài khoản hệ thống thông thường, duy trì bản sao lưu SQLite và để reverse proxy xử lý TLS. Phiên bản ZIP chạy trực tiếp trên localhost mà không cần cấu hình này.

## Học và theo dõi tiến độ

- **Cài đặt** cho phép đổi ngày và nhập sàn band. Tuần 1 bắt đầu vào thứ Hai trùng ngày chọn hoặc thứ Hai kế tiếp. Ở **Lộ trình**, mở tuần cần kéo dài để chèn 1–2 tuần ôn bù. Các ngày và mốc sau đó tự dời.
- **Hệ IELTS** mặc định là Academic. General Training đổi bài Reading và Writing Task 1 từ tuần 17. Listening, Speaking và Writing Task 2 dùng chung.
- Chấm bài Nghe, Đọc và Ngữ pháp theo câu có đáp án. Mở lời nghe sau khi chấm. Với câu mở, dùng bài mẫu và bảng tiêu chí.
- M08 và M16 dùng điểm luyện tập. Nếu dưới 7/10 ở Nghe hoặc Đọc, hoặc dưới 3/4 ở Viết hoặc Nói, bổ sung 1–2 tuần ôn rồi làm M08R hoặc M16R. M24, M30, M35 và M36 dùng đề mới theo các nguồn trong bài, với đồng hồ trong web. Lưu band Viết và Nói khi có kết quả chấm theo tiêu chí. Bảng điểm tính overall khi đủ bốn band.
- Bài viết và từ khóa tự lưu. Cho phép micro nếu muốn thu âm. Trình duyệt giữ bản ghi trên máy và cho phép nghe lại, tải xuống.
- Chế độ khách dùng cùng trình duyệt và địa chỉ để tiếp tục. **Cài đặt → Tải bản sao lưu** xuất JSON có tiến độ, điểm, sổ lỗi và bản ghi. Xuất trước khi chuyển máy, đổi trình duyệt hoặc đổi địa chỉ localhost.

## Chỉnh giáo trình

- `curriculum/weeks.json` chứa lịch, đầu ra và mã bài. Các thuộc tính `academic`, `general` và `byTrack` điều chỉnh bài liên kết và nội dung theo hệ.
- `curriculum/lessons.json` chứa bài, ví dụ, nhóm câu hỏi, đáp án và tiêu chí. Với câu có thể chấm, đặt đáp án chính trước trong `answers`, rồi thêm định dạng tương đương. Với câu mở, dùng `model`.
- `curriculum/audio.json` chứa từng lượt lời. `dist/audio/<mã>.mp3` chứa bản đọc đi kèm. Nếu đổi lời nghe hoặc câu hỏi, đối chiếu file MP3, lời nghe và từng đáp án. Nghe thử ở tốc độ 1× và tua lại trước khi phát hành.
- `dist/index.html`, `dist/styles.css` và `dist/app.js` chứa giao diện và luồng học.

Sau khi chỉnh nội dung hoặc số phiên bản, chạy:

~~~sh
python3 build_course.py
python3 build_course.py --check
node --check dist/app.js
~~~

Bước cuối dùng Node.js để kiểm tra cú pháp. Chạy website chỉ cần Python 3 và trình duyệt hiện đại. Dữ liệu sinh ra ở `dist/course-data.js` được đưa vào Git để bản ZIP chạy ngay sau khi giải nén.

Mỗi commit phát hành là một phiên bản. Tăng `version` trong `package.json`, tạo lại dữ liệu, kiểm tra M00 và U01 trên localhost, rồi tạo tag `vX.Y.Z` cho commit.

## Nguồn giáo trình

Nội dung và lịch dựa trên bộ tự học IELTS 6.0 gồm giáo trình 75 trang và sổ theo dõi 36 tuần. MP3 M00 và ảnh học tập lấy từ bản demo của bộ tự học. Các bản nghe còn lại dùng giọng tổng hợp theo bản lời của từng bài, gồm hai bài đo lại cùng mức. Một số biểu tượng lấy từ website Tiếng Anh giao tiếp 12 tuần.

- [IELTS Academic · Câu hỏi mẫu](https://ielts.org/take-a-test/preparation-resources/sample-test-questions/academic-test)
- [IELTS General Training · Câu hỏi mẫu](https://ielts.org/take-a-test/preparation-resources/sample-test-questions/general-training-test)
- [IELTS · Cách tính band](https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail)
- [British Council · Đề thi thử IELTS](https://takeielts.britishcouncil.org/prepare/ielts-free-practice-mock-tests)
