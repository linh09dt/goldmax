import { ErpShell } from "@/components/erp-shell";
import { SurveyForm } from "@/components/survey-form";

/**
 * V126 — Trang khảo sát nhà máy (bộ câu hỏi V125 cho module Lên kế hoạch sản xuất).
 * Nhà máy điền trực tiếp trên app; câu trả lời lưu vào bảng survey_answers và xuất được ra Excel/.md.
 */
export default function SurveyPage() {
  return (
    <ErpShell
      title="Khảo sát nhà máy — chuẩn bị cho module Lên kế hoạch sản xuất"
      subtitle="Mỗi tổ trả lời phần của mình. Trả lời tự động lưu; xong thì xuất file gửi lại để lên phương án thiết kế."
    >
      <SurveyForm />
    </ErpShell>
  );
}
