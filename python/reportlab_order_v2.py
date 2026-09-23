"""GOLDMAX - PDF V2 bằng ReportLab.

Dùng độc lập:
    python python/reportlab_order_v2.py --input order.json --output bao-gia-v2.pdf

Payload JSON là dữ liệu đơn hàng đã chuẩn hóa của web app. Ứng dụng hiện tại import
Excel vào PostgreSQL/Supabase trước, sau đó API PDF V2 truyền payload cùng cấu trúc
vào hàm build_order_pdf().
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import math
import os
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime
from pathlib import Path
from typing import Any, Iterable

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.platypus import (
    Image,
    Paragraph,
    LongTable,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

PAGE_W, PAGE_H = landscape(A4)
LEFT = RIGHT = 12 * mm
TOP = BOTTOM = 10 * mm
CONTENT_W = PAGE_W - LEFT - RIGHT  # 273 mm

NAVY = colors.HexColor("#1E3A8A")
AMBER = colors.HexColor("#D97706")
TEXT = colors.HexColor("#1F2937")
MUTED = colors.HexColor("#6B7280")
LIGHT = colors.HexColor("#F3F4F6")
BORDER = colors.HexColor("#D1D5DB")
PALE_AMBER = colors.HexColor("#FFF7E6")
WHITE = colors.white

COMPANY = "CÔNG TY TNHH SXTM GOLDMAX VIỆT NAM"
COMPANY_LINE = "\n".join([
    "GPĐKKD Số: 2401031714",
    "VP Miền Bắc: Số 670 Toàn Thắng - Xã Thuận An - TP. Hà Nội",
    "VP Miền Nam: A34 Shophouse Phú Mỹ Hiệp - TP. Hồ Chí Minh",
    "NHÀ MÁY SẢN XUẤT: Cụm CN Non Sáo, Xã Tân Dĩnh, Bắc Ninh",
    "Hotline: 1900 8135",
    "Email: Goldmaxdoor@gmail.com",
])
TITLE = "THÔNG TIN ĐƠN HÀNG"

# Logo GOLDMAX nhúng trực tiếp để PDF V2 vẫn có logo trên Vercel Python Function.
# Vercel có thể không bundle thư mục public/ vào Python Function, nên đây là fallback
# độc lập với filesystem. Khi chạy local vẫn ưu tiên public/goldmax-logo.png.
_EMBEDDED_LOGO_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAQ0AAABMCAYAAAB3YeJ1AAAbQ0lEQVR42u1daXgUxdZ+q3qmZyaTfSEsQoAQBdkx7MgiJCggoiKg9wICClwVEUFBEHKjgoigbKKigIB6BfzcRQwgQRHZCQi4ESCsIRCyz951vh8hgZBMFjIJCdT7PPNMT033qerTVW+fOlV1in0V05TAmHAoyhODph9YAQkJCYliwL6KaUoKY2CMAYyB8dxjAiNSxJB+Uw6slWqSkJAokTSu/eByegbYcwMn7VwgVSchIUmjVKRR4HM5LZnh+z8u6gbExm51SZVKSEjSKJE0cE06AWTlLL332PhAqWIJiZsLuooQyjlj3owF/Lq0B11NJi7Q8S6jNjeUapeQkKRRKugZb7BrRTRdbbU4Gf7q+O8fGstHISEhSaNUUMHu2PdJX7q6C2QnkfI7c3Z9YvCPf8lHJCEhSaNEGLlSox3T/fn75w/m+0ucENopIR7sP/Drb+Vjk5CQpFGyRcIUpZFe980f3wzKd75qECIb9Gj7fuvkXBIJiUpChYyeXElH6WW5SUcRcgumo8D/xBggqGej3h//JB+vhMQtbGmUmgUBMIVvPr55eAFySbI5piRn2ucOGrROk49dQkJaGvn/w+31KCTvvNO5oXW3en0ZixWyKkhIlA78Vr75mqp6b/KO89LykJCoLt0TASBZ0Mfeimv+PY/F7S2PrF++HdRS5aypH9d/rOoZk49WQqIak8Yl0MKj2Ukvjh9/1F7U/5+vujdmzyf9pjg47jNxbuZl6J44IQQDNqZpLKl938/GAPi0qDx2bhr6fm1VHX0zPbx//vnvO/W8/WrYhNbfpNOpDJf1kuvZAfK5M++YXU5icGiCHKDfQXTEL/TpR6vavVmPTaMy97UVPZiignEVTFFBXG2rhozdU9FltRydeoZxVrvYsjEFUPTgSm7ZmGK4/K3mLr0gDSQ0oNC3uPKbBCA0EOX+Fpp2QXM5j4K0P1wafRrQ9K3N1ZI0NEF0ARj8yFPx665OX7+s17TtH4bF6hRFKdqnAZhYbnUvC1TGOWOsd02FITHu36MLrYNhDMkOR2z7XqvHABiTd93vW4Z399MbftIrVdsqSU6Mme2nGl9UuMLyGj4uN3x2ueheStkfo6pTmArWAmAttLQPh7CriAVgyG2xNFfxH/GCfLdWTTCGEM55iOaijozEyNQDz0G4NGiaBqFp0Fy53y6XK97hdIxoct+aE1WSNE5xZeXQp7as+/69rhv8udI7vwEDYLzyXSgMQG2DIebk1pExeRaKRRM/3tF9+b1V0aeTnRS7WM/1T19rGVR+hWQA2CSRuWpSnuWS7XS69pw7EdCjWWy2bLLViFzAu+u5/vjf6x+F0AQ0TYPmsoa3GPj9sSpBGvUhHt/2XvfHWRV+gZt1Su8zv47OX0yX7HI1a333h4dvVHnOH3050V81NsQNIojSwltVdd3Dbs+izI8BEFIzrHWD644+LZtldSQSNfHAmv7QNAEdUWCLf32fVqV8GlUdNfX6Q8k7n4ILQtzW/j2lMvI8fPj5nuHefpsK+h6qFwL9jKdExkpkOW05fsFjvGVNqp5waOLSzhXR0IRzeKdRW1aVdD6XKrsCPVd4yp5nKGXvM7Rt20ifishj597xM20nYijc23fTzaI3H73RLNI/Ii1tOa1d+4gia1I1tT6Ir9z2XnfavrhbI0ka14E7vMyZKXvHeXTSl/X4DGoZ5D/1pq10jGFg9H0u+8UPHbIGVV+4mPhny9udMqp098SpCc0GV0S3YRuPX8/1P30zsFs91RDv6XJxzlhqwni6ZHMei+iwJPx65WQeneLUK3pdRXRCTuZkTQoPnzHveq79++/Zt4X6+fzlrRq8PGqxKUyvpS2jgxfOzW19+8ty9KUUIIg4JWBU7zJdQ2Bpf01qrgPbDsDs2coP381vdaCez+9gVYY0zkKb/MDQjXM8Ieue/p9vxWUPYkxMN92QLnXsRqb3mBUVaFIbph6YQEEt3y5Tu1//972GHrpImyd9m3aXEJ+mHDWOiVzqLK+s22+fcvrqyvbPiXnPhPsHLvJUWVsE15xkTXnvCVONsQGSFirCsgMBcw8CyPcnpewa1xrAPk/lEfdmW/Lm57w6TTxtvWGksd9hDxkzZuvFipIfG7vVFQsoAHAobpjFW6+YPPSAcOngBApsUTri+GrbSJ8eulqZnrqvNId9aWiD6WMq8tlE1J+4GMDiLftj/Ls1bJjmCZmqTvF3XFzqVINH62Uzr3jUaLdoPwB2LuHfZmQZPTI0numoYQFOs0onjbNEox4atWl5ZSqwWfQqLwBIih/xKtHluQdEIMbArvoGYyAiMGIgRsDlc4kod2CDCMQ4OIBzCc80qNVqcYndqOhaNT1CGILgMt42uVIbXI/WsekA2OHEN+5uElLr5/LKUzh0508vzAy97Vlf2awrB7VafZwDgJ2IHx4PoFt55X3/asvMvtMP+FYaaZyknKDBT+64dKMUGNZ9xfTKzO/P/c95ZOqy1ek87d9get0bpbem4ZN/+VssMEZkB9rKKyvYZPRJTp4fWrPmc+dlk6481O++svvxjUP/BHBH+Uxt+KyaGGoeNu98ToWPnth1WsCNJIwbgXo+XneVV4ZLaBk3kjDy/R58vJ35DvWIVyZYZ0yWzbjy0SBqtUcCd/v7hKRWiqXRY8TW9Ou57uC6AVTR8TQKneMmDsjVMvKOidOIgCZvfXRtubP+mdzdE3oz13vZvypVPE1oGYqi8yufX0guPr5RYKRtBtCznGJUoILnaWRD2G/Wh+BOcSezrAvLK5tAVe5+df7DPUJiew+/GiabcOVDD+egchMPA4uJAS/W0jjPbGHDpxw5eW362tl3+QUb1BItCCt41q32cIKM6h2yihbTdfPzNkotVG8USRqCKKXftIRQdxcNmrI3AwCLW9DxDRXsRbd9WCD4ZlVcml0UGfHLKciVZ8ZdN6NXwUVrhxLf+s0TchKSk6Vf4wbAwfUd4KH5zUVa2TmcrKW5OBPsfPGVHxj9/l035fh8/VbzVxeV7m/Q9fWE/JOJMfuq0v02Dgpp5wk5UZFvZMgmfAOgMU9s8yFiYyGKJA0f4mFrX29VbPi9tW93nBkElDh9eTj3u+nWIaQ7nRZ3//lEvBHviTxCDcbWVcaquvhBlsJZuf1ff11K2y1bb+XjzDf9vMB5uaeZE+Bw2z3JJQ7WZsPrbchtpPBSm9rArx/2pM5PbC6Tzd3ika88aqOf3DrSY97F+q0WFvsATlpz5tXzMk8sbz7207Ppu9Nn6j7cYdENi1mRev79DH/V6JFl73dGTGknm3Dlw+4VlAOt/PGz+8ccMrntnngaHMCOZb3ouyVdbsgahKR4zxFGmt1W4uy6xs0XTPJUhvfXrXMqO2lmpW+xkHDuTbPIWEkBJpNHZnGezDxjks23ckEx4EnxIzxSFQUhJ++4UteehBhNl3atiMZFHffrM3RDZkXn90fcMKdJr3juHplo3fCuJQmlOdUcPotdT3DcoqDqdMxxZg5lOG3OkPoz1IrU2aHzi73vNHhneTIwkBI4Wk7QqGSc3fbEJ6cJj3nCwgCA+6cf8L4hpJGHYEEZu1fdi2xQanzijzViY+GxN+n6r4e0aGxWD+R3qzxlYThywsIjl54syzWmhjNZVuJLTh3zDHH5qSa94+xcAgOSsi1zIiJmTPbIG4nALiW/k55rVXhOZwSCLvBJSRiVhJSEca2Zhn15gYXh8gxhMFD/q3/f0HgaPowH9Y/ooz3wSW4D1xiJHOKnuj32bf3SXP/dFwNnR6j6p7nCvK+eEeppBLWcf91CfcJf1yckTDTf4efl0WC8Yd7mF53Jb72YFz3cJciVYrX8ExY+7c6Srk1OWnAywMtYR6dwDjCIdCDA6Fm9OYR2xhQ0+jbZlD0LS1JMFybYeILWmzSXGUQ8N+p4bsBgAc/u/eUi7aE+L+3/tsqQRiEzlnHux1nYgbUPUFm2ZawobD53tsbgPp9fKK+cVq3m5QBgiX+8uL2OydSxIsqqU5iutrd3E2fKQirNvicVqTgeMKpKWBecYbdIW5a7BwoJkOYEaQ6QcFw51pwgUcrQJIJmmRrNmlYRZWXg0VraMirVvidcy12RzXmuRVFR+ss4Z+oTm1RosaIMLFwE/rFlt+vc+SOPDw+GN5nTCQAOHXzxnUZ+Xk/dTDojIvx85oSP3N7gZniWWNFj/PaRbl9QUkW5sAmXtX77pV6VkVezFnOeBvD0l1uG+9/bMDytOnf6XZpYowaOGCJr0E1AFhqt6DI2fmSJVq2nM04DjgcCDaqDkpxCE7vTLRED+3167Ebk/2CPlem47HlM+mPKXaHe3nuqA4FkOqwH/IKfbCWbWfWHIJGeZnXWjxqzqdQzdT1OGhngW/uP3dIw3y/wfo99XgqrMrMbz9tcqyOjPhpW1R5eWJPZe3HV0EXy0RlrAoxeg6pC2WxOp7b/rzSfTp0mWmUzuxm6H9rM5gO/fPl6r6+wHdaIQKmM2vUcs6XNtef8+lHUzwopXXRKxa3MspNmOWvX/u+ePv8rRBC/bRr+Vj2TYUKeU7VWx/eq3Au+ZqNXBgMYfHXan3++vLyO2fthg05XIWHzNCEIYNv1gaO6yKZVzS0IQAO0BAWuJ8N6rd7vSdnsq5impFw9IlHk5sxFTCMvELTGXXrhYDapsLfYlfTzYU/OzXCH7757LMBXj+1hBmPj4oLwVEXSkJCoqqhURygDEMKMB/s27I1+qwo3XgEQU0AgRtnE7amg3QDw4KPfdAeAL9Y98DFnym01mNLGRweTTlEYAzhXOOPFRO6SkJCopqRREji/3NQ5gz9jXgGMdwNjOPTFw1RsuD/5HG8ujG/bW+HK9wVm9OZbigWPQ/yd9c9M2VXqBX0+z7bbZ7dpLUAABIGIAJEbgR5EgLj8DcD5ycHrbh9+c7q1srrYHqYwQMcAhecuwuIcPoq2+eJ/Npd6Y6TAce18cwRdgiBAI0BD7nfe78v34FNTV/fi/H3nSpKnTu18jiksBArPLZvu8ree55ZTYVAVWpc1Ou7RItuprKESVa9DrjAiruR/4P5zIcN4qiyibXZqTcSU0nyut/g1Xu/Z0OJg+4lxpdCHcyWT6aODlvR+rbTyLi3alWl/Z7fOy6g7lquTa8oqcj+ZZ7Sz5hGtvyyWMCZ1EhCsJqGIsl0unz3ZZnRHGJI0JG4KeMd0iyvNefr/tK1wP1rA7Lv80hyuxJLOyxKY5rOgx9CyyE57e8ftjg92M8B9EFmnlQao/2pd6D5Dp3aerE7oRMX11w2gdx1PbWCI3eoqtkcgq5xEdYfDSVGhr949uLhzTOM6OCrDwZVtMaeX9lw76Vd5LegRXeb7Xb6He5n5imJOYeqwuyhwQrtnAMA4tr2WlqXNLlamd5qa9ezGUs1SlqQhUe2gMHa40Fs4B5+5O993SodGLo0KhZ00+ypdPVku/bS7yxwKweVUfgxZ2L1zWa9LX7J7pGP1PsYYubUKsjPEInV0WxLMfTs362ixY/JmhjF7S703sCQNiWoH+xu/NCvKRDe91KVwzNpHoFiz6J9rk40mlpQ+f9cvHiOMKV3cEoaZ00+OS6cN7v7PsCrb/N/seF1bO9g/SdCb/dh1hUhwxMSztMnx48p6nSQNiWqJYF9WaPRB01DD/+XOBeLW6mt2KPJNnLVod/2a09p6xNLQv9jJra+ECS0n7bnNPRF7xBGoxzJ351kcxhOIufO6Aiylvb9/jmPtAcYYSrV9pp+ZxTpe/fm6u2qSNCSqJc5N+3kj56LQTEeLHc/nHQdO6TiiqGsNRldTAOCk+JW3HIZJHe0oZtTfPiU+P+JV8ti4J4g0t0GpVaXGdW8uZhjcUiNCqfaUycihmJBXO4VL0pC49bops35tU1S68fmOTp9ZbYOyrFheqGGqyMpelHDEE/kbJrZLFeR+j5sQPZtxbZrz6Y3FBqVWZ3Qr0whP6LjIl9QhrYiobG05w6E7aozpel0be8ul8RLVGv5mGpBuYV9dnSYY19ku6C8WNTKZs2i3R9bt6Me3PSE0HohiZnNccNIr6pyerxSY3KWU2LaZOrWL5pi1rcR5IurQVo60VM3tvkLe/vwDl2AGmx1FLtAUnBvUmT3IZFB6ZUzatFlaGhK3BFJe/uVrlYtDpWrojGoVeOs70f568jSOizwCwStuT1rGuDq5s9uuit+z7Raow+8igLslDEcDq+HSW7tGZ87fOdzhZS12CwqrRpsMc3s5JGlI3DLIfm1b8xIJQ2EOy5Ld5d4S0nt8ZIKm8SYVf1dMNb7YuVDEfvWJSM2aLZ51e5Wezjo+2c8Qe+QKCcw7mONYtIPpdXAb2oAY9OrCaPJbEj1adk8kbgkEmvigSzmau60HybJoh6HcebzQ7ofMLGpZ3F5zIUZ98Nmpm1NLK1Od28vtUK0Q8NFP7HDWOW9Hbd+JHb625Yj+0AjuJoSa/DAh48MD893Jy3lzu5dfTEt/q90nza3VAf6+4d3oJfb/xOmkpSFxUyM5Zus6o8qKdHDWCDXcUaQJbxWljjAX9EK71zLTxb3FneNrpmFlIQwA8PG3FOtjYYLVUsd1IJu14DYChe5l7QFWHGHkISP2QLpj9jYGEm5juRJXFPX9+yjwveh3iixTZcbTKFaWm/TSRCO/+n+4vV7G05CQ8ASkpSEhISFJo7TYl5XVTVoZbvq2qSsyXWkfyZigEoVwyzhCLzgtLe/q9dnBov47vv3JLAPTm911q0LaLKgS5Hryn9iNqqKz++rV+7zqvpA/jn/++OuPB3qZVmQ67QuDbps8vrTyss6/s9tLb4hUAp/IJ87ExLm3NwgK/ksQxKn07DoiY+Xt3G/4356+F3vKEo2RYGroM1XyxXUyYcIof4PuQ00TFNBs3k3zcv1+fufTJog69zz3W4GX5Y9vRJJNaAsfeGl/gfqz5pUWe72EaHP/fw+xm5Y07CTslxxaly59P9tT2msadPrAJ+84Zc8z5AJptSMX5+vmwoHnNnAC1zjSCaJbaIuFoQBw5uD4dwxcGcA5PxN459x22X9OjstyunbUaj5vBgCc2TPayz8w5CuHS7RUON/v22imW0faxcSYXkbO5gPMeNxuGx5h9okhQpqp3tTBlpOzvlGYYjTUnRwFANbTc2baz86J41wX5XSJF87ZrTv8ITam2Vxbr5XrSlkcl2F35Xgb9TpNiHaaRr/51H52AACYdPr/EWkFPOlmk+lph6adZgwWJ7P34n7PfAwArtSVXzC94n00/cJr9X38VysKO63zfbzzqVOLHg41e80CkUUNeqJQ1HlX6vtxgqiXwjgjiI3JOdn7bqs3aQqY+JGD6XLLuGAkCEP+ysyYUM/L5xvONfvf6Vl9WjeJPeFWX0mvLVW50k9PdNxUb2pn26lZcZrQvjSHTX/XdvLVOE3TDmgMLQShFUH8FtDglQHXysg5Ni2OMxYlNPoTnE6ZG87KX6buZ+T/cmiuFKEp247seuq1mia13bHtlr6RY5Y6U/ePj8tw2seZGP+fpml+FxyuYa27Lvs1afvo34hE7WwnZjbr/uHSq/P6PW7ol2aFmUGI0lzaNjCyRvT+NPrg949+qgot2EL0k44wIcXhfLzXI1/9EP9534gAqMsdmut2BdjfZvC3+XVn7+r7NhAYtwjXHp1go0iII51HbexRlJ5WxIQZGwbXXe8C7nQK2qkVMfDy7ryWdeDSNnJiQ76d1XoIJxGsaULrP+N31cXYFiKRetNYGlnCdfikM+eRhx5a/0eFZiREFFMUXqPF2/lsm3FkEtmFWBLc7K06AHDu8MRB4CxKMNgBwJI4lYghy9xwZr533HZ8Blk1LSug0cwCHnPbyVfJJUSGd/0YfwBISJhoZt4sCsB5ACBCT6aw/I2cCKINY/oofc3nWa518NrDHDyKMfxQqOyMRZn1ChlCnuYA4Eh5T3OkvCvUGv/hDGgKpkQBwLFjb7avHxi0I9limW4MGlUXAHJSl1mc6R+t0vs/zgXQQ8+Yf1ZK+gBDvQlhWvryr0XmKjpuuVRTDRx1hyN12USRvoK4/4gCbzBd0JhoW8q7QlEAXdDY6CsqpV4Kz52cROARjCGqacSMwwDC08/MjWoWGHAcbtZ0OM6+STlO5yu+dV+qDQBnjv33ScZYFGO5oyeM8SjGqJZv/RnNAcCW9ArZkmLJGBZTQJ654cxo6/GXiXMsMTWctQgAzh954T2zjo/ZfcYW0KPHgnQASPl9gpOB6XzrGnItDoYoPePhtdouabNj/b986wf7ZZz4dfTMsE5LO27ZMtwYoRqsh+Mfj27a/aOBeXk1j179IAAc2zSMbML1ePM+axIv+we6Ms7rtOn7WTSA2QBw+MuB5CKR0vKhL0IBYP36ew0Ja/qTSxMU+dh3XDBEcYB3HR4XDWDq9uX3fLdzeRS1H7mxoPXw7t0nvIiH3f3U1vz0zQs6Wq4esf1xTjshnITeU3bnW1M/zGxFGpCVe6sUyRjvVi19GhZB3+7NzPJr0n8ta3z/Gta432cs8v51zSqcMIoDUf4qSUbUrfDfwpR3vHv3c7UAwCpcu649T9ME6fmVxVMh3qZnispuy5ZuOgDgnDUtk39C0/InCQnSSFF4ocZosWQfBgBfVe2eXy4h4nMcrgLDmJGRsZbchp6L8JrPnfe0Wl0kSoxLwRnG5jd+nS6qkO5BF0ttnWpa3Suy2E4AaBTAe+alqYwXerk6oF0EgA59PskEAI0oFQB69Fhp84QOGERQ3rEpzeqTm2fR96TjzM1+w/xzAPjfwq53X5GLa+arkEO5aiuRFa+3rJ9LvHDbJa2SQ64CtKLN4G9HVgcyS9w3/iWb0LY1jVxcZGyGPw5NeMxAvKGFec9p1iy2yKm62Ukxw/TQMUPY9JW55DDc2CmisVUQzpvqvlQz77wzia/OybDnvHHnnbNTK/KekpLmTxBgtgZh49/1pNzzpxbMTXPlbGrcYOqGslx3KHFyvXBD8AnTbS8UeMmd/Dt2Ro7m+LlJk5nx5SnXHwkT7zfq0KxBs3mv56Ud/O3ZULMRT4W3Xhjjaf1uWz9onBBA135rFxV33g9r+vc1Edp3H/LNjPLkt2ZR1+ZeRIPvf/YXtxskrXyjbaSBxIPpTtvysdMPFxuu8IaShiBGNiY2dBv2Yx/pkwYuJcasN+i4IdMh0mpFxA6UGrm1sX/tA61A2NF68NfGqlSuSiMNAdBZzlc/MnLjcFkdJCSqLyrEESoE0QE93TPuya3xUsUSEpI0CsHqtNS+7/mSN2mRkJC4xUhDALAy0XbA87v3SNVJSEjSKAAXY45zOtw3+oW9P0k1SUhIFCANG6O/k3R4YNK03/+UKpGQkCgO/w+xDMdak1flbAAAAABJRU5ErkJggg=="


def _find_font_file(names: Iterable[str]) -> str | None:
    roots = [
        Path(os.getenv("REPORTLAB_FONT_DIR", "")) if os.getenv("REPORTLAB_FONT_DIR") else None,
        Path("public/fonts"),
        Path("/usr/share/fonts/truetype/dejavu"),
        Path("/usr/share/fonts/truetype"),
        Path("/usr/share/fonts"),
    ]
    for root in roots:
        if not root or not root.exists():
            continue
        for name in names:
            direct = root / name
            if direct.exists():
                return str(direct)
        try:
            for path in root.rglob("*.ttf"):
                lower = path.name.lower()
                if any(name.lower() == lower for name in names):
                    return str(path)
        except OSError:
            pass
    return None


def _fontpkg_roboto_files() -> tuple[str | None, str | None, str | None]:
    """Lấy trực tiếp file Roboto từ các package fontpkg trên Vercel.

    `fontpkg.path()` trả về *đường dẫn file font*, không phải thư mục.
    V41.2 đã coi giá trị này là thư mục nên không tìm được .ttf và có thể
    làm Python Function lỗi ngay lúc import trên Vercel.
    """
    try:
        import fontpkg  # type: ignore

        regular = str(fontpkg.path("Roboto"))
        bold = str(fontpkg.path("Roboto", weight=700))
        italic = str(fontpkg.path("Roboto", style="italic"))
        return regular, bold, italic
    except Exception:
        return None, None, None


def register_fonts() -> dict[str, str]:
    # 1) Ưu tiên Roboto Unicode đóng gói bằng pip trên Vercel.
    regular, bold, italic = _fontpkg_roboto_files()

    # 2) Cho phép override bằng env và fallback sang font Unicode của hệ điều hành khi chạy local.
    regular = os.getenv("REPORTLAB_FONT_PATH") or regular or _find_font_file([
        "DejaVuSans.ttf", "NotoSans-Regular.ttf", "Arial.ttf", "LiberationSans-Regular.ttf"
    ])
    bold = os.getenv("REPORTLAB_FONT_BOLD_PATH") or bold or _find_font_file([
        "DejaVuSans-Bold.ttf", "NotoSans-Bold.ttf", "Arial Bold.ttf", "LiberationSans-Bold.ttf"
    ])
    italic = os.getenv("REPORTLAB_FONT_ITALIC_PATH") or italic or _find_font_file([
        "DejaVuSans-Oblique.ttf", "NotoSans-Italic.ttf", "Arial Italic.ttf", "LiberationSans-Italic.ttf"
    ])

    if regular:
        pdfmetrics.registerFont(TTFont("GM-Regular", regular))
        pdfmetrics.registerFont(TTFont("GM-Bold", bold or regular))
        pdfmetrics.registerFont(TTFont("GM-Italic", italic or regular))
        return {"regular": "GM-Regular", "bold": "GM-Bold", "italic": "GM-Italic"}

    # Không âm thầm dùng Helvetica vì Helvetica không có đủ glyph tiếng Việt.
    raise RuntimeError(
        "Không tìm thấy font Unicode cho PDF V2. Hãy bảo đảm dependency fontpkg-roboto được cài đặt."
    )


FONTS = register_fonts()


def pstyle(name: str, *, size: float = 8, leading: float | None = None, font: str = "regular",
           color: colors.Color = TEXT, align: int = TA_LEFT, **kwargs: Any) -> ParagraphStyle:
    return ParagraphStyle(
        name,
        parent=getSampleStyleSheet()["BodyText"],
        fontName=FONTS[font],
        fontSize=size,
        leading=leading or size * 1.18,
        textColor=color,
        alignment=align,
        spaceBefore=0,
        spaceAfter=0,
        splitLongWords=1,
        **kwargs,
    )


S = {
    "company": pstyle("company", size=12, font="bold", color=NAVY),
    "company_line": pstyle("company_line", size=7.0, leading=8.4, color=MUTED),
    "title": pstyle("title", size=14, font="bold", color=NAVY, align=TA_RIGHT),
    "order_code": pstyle("order_code", size=8.5, font="bold", color=AMBER, align=TA_RIGHT),
    "meta": pstyle("meta", size=8.0),
    "meta_bold": pstyle("meta_bold", size=8.0, font="bold"),
    "th": pstyle("th", size=6.5, leading=7.2, font="bold", color=WHITE, align=TA_CENTER),
    "main": pstyle("main", size=6.8, leading=7.8, font="bold"),
    "body": pstyle("body", size=6.7, leading=7.7),
    "detail": pstyle("detail", size=6.5, leading=7.4, font="italic", color=MUTED),
    "detail_right": pstyle("detail_right", size=6.5, leading=7.4, font="italic", color=MUTED, align=TA_RIGHT),
    "num": pstyle("num", size=6.7, leading=7.7, align=TA_RIGHT),
    "num_bold": pstyle("num_bold", size=6.7, leading=7.7, font="bold", align=TA_RIGHT),
    "center": pstyle("center", size=6.7, leading=7.7, align=TA_CENTER),
    "note": pstyle("note", size=6.3, leading=7.3),
    "export_note": pstyle("export_note", size=9, leading=10.5, font="bold", color=AMBER, align=TA_CENTER),
    "check_title": pstyle("check_title", size=7.7, font="bold", color=NAVY),
    "check": pstyle("check", size=6.7, leading=8.1),
    "summary": pstyle("summary", size=7.5),
    "summary_bold": pstyle("summary_bold", size=7.5, font="bold"),
    "summary_amount": pstyle("summary_amount", size=7.5, font="bold", align=TA_RIGHT),
    "summary_total": pstyle("summary_total", size=7.5, font="bold", color=WHITE),
    "summary_total_amount": pstyle("summary_total_amount", size=7.5, font="bold", color=WHITE, align=TA_RIGHT),
    "words": pstyle("words", size=6.4, leading=7.4, font="italic", color=MUTED, align=TA_RIGHT),
    "sign": pstyle("sign", size=7.3, leading=8.5, font="bold", align=TA_CENTER),
    "sign_sub": pstyle("sign_sub", size=6.3, leading=7.3, color=MUTED, align=TA_CENTER),
}


def esc(value: Any) -> str:
    text = "" if value is None else str(value)
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def para(value: Any, style: str = "body") -> Paragraph:
    return Paragraph(esc(value).replace("\n", "<br/>"), S[style])


def money(value: Any) -> str:
    n = number(value)
    if n is None:
        return ""
    return f"{int(round(n)):,}".replace(",", ".")


def decimal4(value: Any) -> str:
    n = number(value)
    if n is None:
        return ""
    return f"{n:.4f}".rstrip("0").rstrip(".")


def integer(value: Any) -> str:
    n = number(value)
    if n is None or n == 0:
        return ""
    return f"{int(round(n))}"


def number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return float(value) if math.isfinite(float(value)) else None
    text = str(value).strip().replace(",", "")
    try:
        n = float(text)
    except ValueError:
        return None
    return n if math.isfinite(n) else None


def clean(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    return "" if text in {"", "-", "—"} else text


def fmt_date(value: Any) -> str:
    if not value:
        return ""
    if isinstance(value, datetime):
        value = value.date()
    if isinstance(value, date):
        return value.strftime("%d/%m/%Y")
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%d/%m/%Y"):
        try:
            return datetime.strptime(text[:19], fmt).strftime("%d/%m/%Y")
        except ValueError:
            continue
    return text


def has_pricing(value: Any) -> bool:
    n = number(value)
    return n is not None and n > 0


def line_amount(row: dict[str, Any]) -> float:
    explicit = number(row.get("amount"))
    if explicit is not None and explicit > 0:
        return explicit
    return (number(row.get("pricingQuantity")) or 0) * (number(row.get("unitPrice")) or 0)


def build_groups(order: dict[str, Any]) -> list[dict[str, Any]]:
    groups: list[dict[str, Any]] = []
    for item in order.get("items") or []:
        rows: list[dict[str, Any]] = []
        if has_pricing(item.get("pricingQuantity")):
            rows.append({"row": item, "main": True, "first": True})
        details = item.get("details") or []
        if not details and isinstance(item.get("rawBlock"), list):
            details = raw_block_details(item.get("rawBlock") or [])
        for detail in details:
            if has_pricing(detail.get("pricingQuantity")):
                rows.append({"row": detail, "main": False, "first": len(rows) == 0})
        if rows:
            groups.append({
                "lineNo": item.get("lineNo"),
                "setNo": item.get("setNo"),
                "imagePath": item.get("imagePath"),
                "rows": rows,
            })
    return groups


def raw_block_details(block: list[Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for raw in block[1:]:
        if not isinstance(raw, dict):
            continue
        out.append({
            "productName": raw.get("C"), "productCode": raw.get("D"), "model": raw.get("E"),
            "openingDirection": raw.get("F"), "trimDirection": raw.get("G"), "paintColor": raw.get("H"),
            "heightMm": raw.get("I"), "widthMm": raw.get("J"), "frameMm": raw.get("K"),
            "clearHeightMm": raw.get("L"), "clearWidthMm": raw.get("M"), "panelInfo": raw.get("N"),
            "quantity": raw.get("T"), "unit": raw.get("U"), "pricingQuantity": raw.get("V"),
            "unitPrice": raw.get("W"), "amount": raw.get("X"), "note": raw.get("Y"),
        })
    return out


def totals(order: dict[str, Any], groups: list[dict[str, Any]]) -> dict[str, float]:
    goods = round(sum(line_amount(entry["row"]) for g in groups for entry in g["rows"]), 2)
    shipping = max(0.0, number(order.get("shippingFee")) or 0.0)
    order_total = round(goods + shipping, 2)
    discount_pct = max(0.0, min(100.0, number(order.get("discountPercent")) if number(order.get("discountPercent")) is not None else 12.0))
    discount = round(order_total * discount_pct / 100.0, 2)
    after = round(max(0.0, order_total - discount), 2)
    deposit = max(0.0, number(order.get("depositAmount")) or 0.0)
    warehouse = max(0.0, number(order.get("warehouseReceiptDeduction")) or 0.0)
    due = round(max(0.0, after - deposit - warehouse), 2)
    return {
        "goods": goods, "shipping": shipping, "orderTotal": order_total, "discountPercent": discount_pct,
        "discountAmount": discount, "afterDiscount": after, "deposit": deposit,
        "warehouse": warehouse, "paymentDue": due,
    }


def _download_image_bytes(url: str, max_bytes: int = 6_000_000, timeout: float = 1.5) -> bytes | None:
    """Tải ảnh sản phẩm với giới hạn dung lượng để bảo vệ Vercel Function."""
    if not url or not re.match(r"^https?://", url, re.I):
        return None
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "GoldMax-PDF-V2/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read(max_bytes + 1)
            if len(data) > max_bytes:
                return None
            return data
    except Exception:
        return None


def _optimize_product_image(data: bytes) -> bytes | None:
    """Thu nhỏ ảnh trước khi nhúng PDF.

    Ảnh trên web có thể vài MB. Nếu ReportLab nhúng nguyên ảnh cho 10-20 bộ cửa,
    PDF nhiều trang có thể vượt bộ nhớ/response limit của Vercel và trả 500.
    Cột ảnh trong PDF chỉ rộng ~11 mm nên 240 px là đủ sắc nét khi in.
    """
    try:
        from PIL import Image as PILImage, ImageOps

        with PILImage.open(io.BytesIO(data)) as source:
            image = ImageOps.exif_transpose(source)
            if image.mode in {"RGBA", "LA"} or (image.mode == "P" and "transparency" in image.info):
                rgba = image.convert("RGBA")
                background = PILImage.new("RGB", rgba.size, "white")
                background.paste(rgba, mask=rgba.getchannel("A"))
                image = background
            else:
                image = image.convert("RGB")

            image.thumbnail((240, 240), PILImage.Resampling.LANCZOS)
            out = io.BytesIO()
            image.save(out, format="JPEG", quality=68, optimize=True, progressive=False)
            return out.getvalue()
    except Exception:
        return None


def _fetch_and_optimize_image(url: str) -> tuple[str, bytes | None]:
    """Tải + thu nhỏ một ảnh trong worker riêng.

    Quan trọng với Vercel: không giữ toàn bộ ảnh gốc trong RAM cùng lúc và không
    tải tuần tự từng ảnh khi ReportLab đang layout nhiều trang.
    """
    raw = _download_image_bytes(url, timeout=1.5)
    return url, (_optimize_product_image(raw) if raw else None)


def _prefetch_product_images(groups: list[dict[str, Any]]) -> dict[str, bytes | None]:
    """Prefetch ảnh sản phẩm song song trước khi dựng bảng.

    Bản cũ tải ảnh *ngay trong* `_image_flowable`. Với đơn nhiều bộ cửa, mỗi URL
    có thể chờ đến 3 giây nên Vercel dễ chạm timeout khi PDF sang trang 2+.
    Bản này tải tối đa 6 ảnh song song, timeout ngắn; ảnh nào chậm/lỗi sẽ để trống
    thay vì làm hỏng toàn bộ PDF. Cache chỉ giữ thumbnail JPEG đã nén.
    """
    urls: list[str] = []
    seen: set[str] = set()
    for group in groups:
        url = clean(group.get("imagePath"))
        if url and re.match(r"^https?://", url, re.I) and url not in seen:
            seen.add(url)
            urls.append(url)

    cache: dict[str, bytes | None] = {url: None for url in urls}
    if not urls:
        return cache

    # Giữ concurrency vừa phải để không tăng RAM đột biến trên Vercel.
    workers = min(6, len(urls))
    executor = ThreadPoolExecutor(max_workers=workers, thread_name_prefix="gm-img")
    futures = [executor.submit(_fetch_and_optimize_image, url) for url in urls]
    try:
        for future in as_completed(futures):
            try:
                url, data = future.result()
                cache[url] = data
            except Exception:
                # Ảnh lỗi không được phép làm hỏng PDF.
                continue
    finally:
        executor.shutdown(wait=True, cancel_futures=True)
    return cache


def _image_flowable(url: str, cache: dict[str, bytes | None]) -> Any:
    if not url:
        return para("", "center")

    # Không tải mạng ở đây. ReportLab có thể gọi/split bảng nhiều lần khi phân
    # trang; network I/O trong quá trình layout là nguyên nhân PDF nhiều trang
    # chậm và dễ 500 trên Vercel.
    data = cache.get(url)
    if not data:
        return para("", "center")
    try:
        img = Image(io.BytesIO(data), width=11 * mm, height=11 * mm, kind="proportional")
        img.hAlign = "CENTER"
        return img
    except Exception:
        return para("", "center")


def _draw_footer(canvas: pdfcanvas.Canvas, doc: SimpleDocTemplate, order_code: str) -> None:
    """Footer nhẹ, không lưu lại toàn bộ state của từng trang.

    Bản NumberedCanvas cũ giữ page state cho đến cuối tài liệu để tính X/Y.
    Trên serverless, tài liệu nhiều trang + nhiều ảnh có thể làm peak memory tăng mạnh.
    Footer này vẽ trực tiếp từng trang nên RAM ổn định hơn.
    """
    canvas.saveState()
    y = 5.5 * mm
    canvas.setStrokeColor(colors.HexColor("#E5E7EB"))
    canvas.setLineWidth(0.5)
    canvas.line(LEFT, y + 4 * mm, PAGE_W - RIGHT, y + 4 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont(FONTS["regular"], 6.5)
    canvas.drawString(LEFT, y, f"{COMPANY} - Thông tin Đơn hàng #{order_code}")
    canvas.drawRightString(PAGE_W - RIGHT, y, f"Trang {canvas.getPageNumber()}")
    canvas.restoreState()

def build_order_pdf(order: dict[str, Any], output: str | os.PathLike[str] | io.BytesIO, export_note: str = "", include_images: bool = True) -> None:
    groups = build_groups(order)
    calc = totals(order, groups)
    order_code = clean(order.get("orderCode")) or f"DH-{order.get('id', '')}"

    # ReportLab SimpleDocTemplate does not accept pathlib.Path/PosixPath as a
    # filename. V41.11 passed a Path from the Vercel API when using /tmp, which
    # raised: "Cannot use PosixPath(...) as a filename or file". Keep BytesIO
    # support for local/tests, but normalize every os.PathLike to a real string.
    pdf_target = os.fspath(output) if isinstance(output, os.PathLike) else output

    doc = SimpleDocTemplate(
        pdf_target,
        pagesize=landscape(A4),
        leftMargin=LEFT,
        rightMargin=RIGHT,
        topMargin=TOP,
        bottomMargin=BOTTOM,
        title=f"{TITLE} - {order_code}",
        author=COMPANY,
        subject="Thông tin đơn hàng GOLDMAX V2",
    )

    story: list[Any] = []
    story.extend(_header(order, order_code))
    story.append(Spacer(1, 3 * mm))
    # Prefetch thumbnail trước khi ReportLab bắt đầu layout. Điều này đặc biệt
    # quan trọng với đơn nhiều trang trên Vercel vì tránh network I/O lặp trong
    # quá trình Table.split()/layout.
    image_cache = _prefetch_product_images(groups) if include_images else {}
    story.append(_data_table(groups, image_cache))

    if export_note.strip():
        story.append(Spacer(1, 2.5 * mm))
        note_box = Table([[para(export_note.strip(), "export_note")]], colWidths=[CONTENT_W])
        note_box.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), PALE_AMBER),
            ("BOX", (0, 0), (-1, -1), 1.2, AMBER),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(note_box)

    story.append(Spacer(1, 3 * mm))
    # Không bọc KeepTogether: để ReportLab tự dời/phân trang phần cuối khi cần.
    story.append(_bottom_section(order, calc))

    footer = lambda canvas, doc_obj: _draw_footer(canvas, doc_obj, order_code)
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


def build_order_pdf_bytes(order: dict[str, Any], export_note: str = "", include_images: bool = True) -> bytes:
    output = io.BytesIO()
    build_order_pdf(order, output, export_note=export_note, include_images=include_images)
    return output.getvalue()


def _find_logo_file() -> Path | None:
    candidates = [
        Path(__file__).resolve().parents[1] / "public" / "goldmax-logo.png",
        Path.cwd() / "public" / "goldmax-logo.png",
        Path("/var/task/public/goldmax-logo.png"),
    ]
    for path in candidates:
        if path.exists():
            return path
    return None


def _logo_flowable() -> Any:
    path = _find_logo_file()
    try:
        if path:
            # Local/dev: dùng file public hiện tại và crop vùng trong suốt.
            try:
                from PIL import Image as PILImage

                pil = PILImage.open(path).convert("RGBA")
                alpha = pil.getchannel("A")
                bbox = alpha.getbbox()
                if bbox:
                    pil = pil.crop(bbox)
                stream = io.BytesIO()
                pil.save(stream, format="PNG")
                stream.seek(0)
                img = Image(stream, width=30 * mm, height=12 * mm, kind="proportional")
            except Exception:
                img = Image(str(path), width=30 * mm, height=12 * mm, kind="proportional")
        else:
            # Vercel Python Function có thể không thấy public/. Dùng logo đã nhúng
            # trong chính module Python để không phụ thuộc file tĩnh bên ngoài.
            embedded = io.BytesIO(base64.b64decode(_EMBEDDED_LOGO_PNG_B64))
            img = Image(embedded, width=30 * mm, height=12 * mm, kind="proportional")
        img.hAlign = "LEFT"
        return img
    except Exception:
        # Không để logo làm hỏng toàn bộ PDF nếu dữ liệu ảnh gặp lỗi bất ngờ.
        return para("", "center")


def _header(order: dict[str, Any], order_code: str) -> list[Any]:
    company_block = [
        para(COMPANY, "company"),
        Spacer(1, 0.8 * mm),
        para(COMPANY_LINE, "company_line"),
    ]
    title_block = [
        para(TITLE, "title"),
        Spacer(1, 1.0 * mm),
        para(f"Mã ĐH: {order_code}", "order_code"),
    ]

    # Logo lớn hơn và tách thành cột riêng để không làm co tên công ty.
    header = Table(
        [[_logo_flowable(), company_block, title_block]],
        colWidths=[32 * mm, 123 * mm, 118 * mm],
    )
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    # Khung thông tin giữ đủ 6 trường chính, không rút gọn dữ liệu.
    meta = [
        [
            _meta("Tên đại lý / Khách hàng", clean(order.get("customerName")) or clean(order.get("receiverName")) or clean(order.get("customerCode"))),
            _meta("Mã Đơn Sản Xuất", order_code),
            _meta("Ngày Đặt Hàng", fmt_date(order.get("orderDate"))),
        ],
        [
            _meta("Mã Đại Lý", clean(order.get("customerCode"))),
            _meta("Địa Chỉ Lắp Đặt", clean(order.get("receiverAddress"))),
            _meta("Ngày Trả Dự Kiến", fmt_date(order.get("requiredDeliveryDate"))),
        ],
    ]
    meta_table = Table(meta, colWidths=[CONTENT_W * 0.40, CONTENT_W * 0.34, CONTENT_W * 0.26])
    meta_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.65, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E5E7EB")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return [header, Spacer(1, 2.5 * mm), meta_table]


def _meta(label: str, value: str) -> Paragraph:
    return Paragraph(
        f'<font name="{FONTS["regular"]}" color="#6B7280">{esc(label)}:</font> '
        f'<font name="{FONTS["bold"]}" color="#1F2937">{esc(value)}</font>',
        S["meta"],
    )


def _data_table(groups: list[dict[str, Any]], image_cache: dict[str, bytes | None]) -> Table:
    # Hai dòng header để thể hiện đúng nhóm KT THÔNG THỦY: Cao / Rộng.
    header_top = [
        "STT", "BỘ SỐ", "TÊN SẢN PHẨM / QUY CÁCH", "MODEL", "Ô TH.", "HƯỚNG", "PHÀO", "MÀU SƠN",
        "KT CỬA (MM)", "KHUÔN", "KT THÔNG THỦY", "", "SL", "ĐVT", "KHỐI LƯỢNG", "ĐƠN GIÁ (Đ)",
        "THÀNH TIỀN (Đ)", "GHI CHÚ KỸ THUẬT", "HÌNH ẢNH SP",
    ]
    header_sub = ["", "", "", "", "", "", "", "", "", "", "CAO", "RỘNG", "", "", "", "", "", "", ""]
    data: list[list[Any]] = [
        [para(h, "th") for h in header_top],
        [para(h, "th") for h in header_sub],
    ]
    main_row_numbers: list[int] = []
    detail_row_numbers: list[int] = []
    group_ranges: list[tuple[int, int]] = []

    for group in groups:
        group_start = len(data)
        for entry in group["rows"]:
            row = entry["row"]
            main = bool(entry["main"])
            first = bool(entry["first"])
            h = integer(row.get("heightMm"))
            w = integer(row.get("widthMm"))
            size_text = f"{h} x {w}" if h and w else h or w
            name = clean(row.get("productName"))
            row_values: list[Any] = [
                para(group.get("lineNo") if first else "", "center"),
                para(group.get("setNo") if first else "", "center"),
                para(name if main else f"↳ {name}", "main" if main else "detail"),
                para(clean(row.get("productCode")) or clean(row.get("model")), "main" if main else "detail"),
                para(clean(row.get("panelInfo")), "center" if main else "detail"),
                para(clean(row.get("openingDirection")), "center" if main else "detail"),
                para(clean(row.get("trimDirection")), "center" if main else "detail"),
                para(clean(row.get("paintColor")), "center" if main else "detail"),
                para(size_text, "center" if main else "detail"),
                para(integer(row.get("frameMm")), "center" if main else "detail"),
                para(integer(row.get("clearHeightMm")), "center" if main else "detail"),
                para(integer(row.get("clearWidthMm")), "center" if main else "detail"),
                para(integer(row.get("quantity")), "center" if main else "detail"),
                # ĐVT, Khối lượng, Đơn giá, Thành tiền căn phải.
                para(clean(row.get("unit")), "num" if main else "detail_right"),
                para(decimal4(row.get("pricingQuantity")), "num_bold" if main else "detail_right"),
                para(money(row.get("unitPrice")), "num_bold" if main else "detail_right"),
                para(money(line_amount(row)), "num_bold" if main else "detail_right"),
                para(clean(row.get("note")), "note" if main else "detail"),
                _image_flowable(clean(group.get("imagePath")), image_cache) if main else para("", "center"),
            ]
            data.append(row_values)
            if main:
                main_row_numbers.append(len(data) - 1)
            else:
                detail_row_numbers.append(len(data) - 1)
        group_end = len(data) - 1
        if group_end >= group_start:
            group_ranges.append((group_start, group_end))

    if len(data) == 2:
        data.append([para("Không có dòng hàng hóa có KH/Lượng để xuất.", "body")] + [""] * 18)

    # Tổng đúng 273 mm = 297 - 12 - 12 mm lề.
    widths_mm = [5.5, 10.5, 27, 21, 9, 9, 9, 9, 19, 9, 9, 9, 7, 8, 13, 17, 19, 44, 19]
    assert sum(widths_mm) == 273
    # LongTable tối ưu cho bảng dài. splitInRow cho phép một dòng rất cao
    # (ví dụ ghi chú kỹ thuật dài) được tách an toàn khi vượt chiều cao trang.
    table = LongTable(
        data,
        colWidths=[w * mm for w in widths_mm],
        repeatRows=2,
        splitByRow=1,
        splitInRow=1,
        hAlign="LEFT",
    )
    commands: list[tuple[Any, ...]] = [
        ("BACKGROUND", (0, 0), (-1, 1), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 1), WHITE),
        ("BOX", (0, 0), (-1, -1), 0.55, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, BORDER),
        ("VALIGN", (0, 0), (-1, 1), "MIDDLE"),
        ("VALIGN", (0, 2), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 2.0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2.0),
        ("TOPPADDING", (0, 0), (-1, 1), 3.2),
        ("BOTTOMPADDING", (0, 0), (-1, 1), 3.2),
        ("TOPPADDING", (0, 2), (-1, -1), 2.4),
        ("BOTTOMPADDING", (0, 2), (-1, -1), 2.4),
        ("LEFTPADDING", (17, 2), (17, -1), 3.0),
        ("RIGHTPADDING", (17, 2), (17, -1), 3.0),
        ("TOPPADDING", (17, 2), (18, -1), 3.0),
        ("BOTTOMPADDING", (17, 2), (18, -1), 3.0),
        ("SPAN", (10, 0), (11, 0)),
    ]
    for col in list(range(0, 10)) + list(range(12, 19)):
        commands.append(("SPAN", (col, 0), (col, 1)))
    for idx, row_no in enumerate(main_row_numbers):
        commands.append(("BACKGROUND", (0, row_no), (-1, row_no), LIGHT if idx % 2 else WHITE))
    for row_no in detail_row_numbers:
        commands.append(("BACKGROUND", (0, row_no), (-1, row_no), colors.HexColor("#FBFDFF")))
    table.setStyle(TableStyle(commands))
    return table


def _bottom_section(order: dict[str, Any], calc: dict[str, float]) -> Table:
    reqs = order.get("requirements") or []
    check_lines = []
    for idx, item in enumerate(reqs, 1):
        answer = " - ".join(filter(None, [clean(item.get("answer")), clean(item.get("note"))]))
        text = f"{idx}. {clean(item.get('questionText'))}"
        if answer:
            text += f": {answer}"
        check_lines.append(para(text, "check"))
    if not check_lines:
        check_lines.append(para("Chưa có checklist xác nhận kỹ thuật.", "check"))

    checklist = Table(
        [[para("BẢNG CHECKLIST XÁC NHẬN KỸ THUẬT VỚI ĐẠI LÝ", "check_title")]] + [[x] for x in check_lines],
        colWidths=[CONTENT_W * 0.66],
    )
    checklist.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.65, BORDER),
        ("LINEBELOW", (0, 0), (-1, 0), 0.45, colors.HexColor("#E5E7EB")),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))

    summary_rows: list[list[Any]] = [
        [para("Tổng giá trị đơn hàng:", "summary"), para(f"{money(calc['orderTotal'])} VNĐ", "summary_amount")],
    ]
    discount_row_index: int | None = None
    if calc["discountPercent"] > 0 and calc["discountAmount"] > 0:
        discount_row_index = len(summary_rows)
        summary_rows.append([
            para(f"Chiết khấu thương mại ({calc['discountPercent']:g}%):", "summary"),
            Paragraph(f'<font color="#DC2626"><b>- {money(calc["discountAmount"])} VNĐ</b></font>', S["summary_amount"]),
        ])
    after_index = len(summary_rows)
    summary_rows.append([para("Tổng tiền sau chiết khấu:", "summary_bold"), para(f"{money(calc['afterDiscount'])} VNĐ", "summary_amount")])
    summary_rows.append([para("Đã đặt cọc:", "summary"), para(f"{money(calc['deposit'])} VNĐ", "summary_amount")])
    if calc["warehouse"] > 0:
        summary_rows.append([para("Trừ tiền nhận hàng tại kho:", "summary"), para(f"{money(calc['warehouse'])} VNĐ", "summary_amount")])
    due_index = len(summary_rows)
    summary_rows.append([para("CÒN LẠI CẦN THANH TOÁN:", "summary_total"), para(f"{money(calc['paymentDue'])} VNĐ", "summary_total_amount")])
    summary_rows.append([para(f"(Bằng chữ: {number_to_vietnamese_words(int(round(calc['paymentDue'])))})", "words"), ""])

    summary = Table(summary_rows, colWidths=[CONTENT_W * 0.22, CONTENT_W * 0.12])
    commands: list[tuple[Any, ...]] = [
        ("BOX", (0, 0), (-1, -2), 0.65, BORDER),
        ("INNERGRID", (0, 0), (-1, -2), 0.35, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("BACKGROUND", (0, after_index), (-1, after_index), colors.HexColor("#EEF2FF")),
        ("BACKGROUND", (0, due_index), (-1, due_index), NAVY),
        ("TEXTCOLOR", (0, due_index), (-1, due_index), WHITE),
        ("SPAN", (0, len(summary_rows) - 1), (1, len(summary_rows) - 1)),
    ]
    if discount_row_index is not None:
        commands.append(("BACKGROUND", (0, discount_row_index), (-1, discount_row_index), PALE_AMBER))
    summary.setStyle(TableStyle(commands))

    outer = Table([[checklist, summary]], colWidths=[CONTENT_W * 0.66, CONTENT_W * 0.34], hAlign="LEFT")
    outer.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return outer


def _signatures() -> Table:
    year = datetime.now().year
    data = [[
        [para("ĐẠI LÝ / KHÁCH HÀNG", "sign"), para("(Ký, ghi rõ họ tên & xác nhận kích thước)", "sign_sub"), Spacer(1, 12 * mm), para(f"Ngày .... tháng .... năm {year}", "sign_sub")],
        [para("CÁN BỘ KINH DOANH", "sign"), para("(Ký, ghi rõ họ tên)", "sign_sub"), Spacer(1, 12 * mm), para(f"Ngày .... tháng .... năm {year}", "sign_sub")],
        [para("CÔNG TY TNHH SXTM GOLDMAX", "sign"), para("(Duyệt đơn sản xuất)", "sign_sub"), Spacer(1, 12 * mm), para(f"Ngày .... tháng .... năm {year}", "sign_sub")],
    ]]
    table = Table(data, colWidths=[CONTENT_W / 3] * 3)
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return table


def number_to_vietnamese_words(value: int) -> str:
    if value == 0:
        return "Không đồng"
    digits = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"]
    scales = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"]

    def read_three(n: int, full: bool) -> str:
        hundred, rem = divmod(n, 100)
        ten, one = divmod(rem, 10)
        words: list[str] = []
        if hundred or full:
            words += [digits[hundred], "trăm"]
        if ten > 1:
            words += [digits[ten], "mươi"]
            if one == 1:
                words.append("mốt")
            elif one == 5:
                words.append("lăm")
            elif one:
                words.append(digits[one])
        elif ten == 1:
            words.append("mười")
            if one == 5:
                words.append("lăm")
            elif one:
                words.append(digits[one])
        elif one:
            if hundred or full:
                words.append("lẻ")
            words.append(digits[one])
        return " ".join(words)

    n = abs(int(value))
    chunks: list[int] = []
    while n:
        chunks.append(n % 1000)
        n //= 1000
    words: list[str] = []
    for i in range(len(chunks) - 1, -1, -1):
        chunk = chunks[i]
        if not chunk:
            continue
        words.append(read_three(chunk, i < len(chunks) - 1 and chunk < 100))
        if i < len(scales) and scales[i]:
            words.append(scales[i])
    result = " ".join(words).strip()
    return result[:1].upper() + result[1:] + " đồng"


def load_json(path: str | os.PathLike[str]) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError("JSON phải là một object đơn hàng.")
    return data


def main() -> None:
    parser = argparse.ArgumentParser(description="Xuất GOLDMAX PDF V2 bằng ReportLab")
    parser.add_argument("--input", required=True, help="File JSON đơn hàng đã chuẩn hóa")
    parser.add_argument("--output", required=True, help="Đường dẫn PDF đầu ra")
    parser.add_argument("--note", default="", help="Chú thích chỉ dùng cho lần xuất")
    args = parser.parse_args()
    order = load_json(args.input)
    build_order_pdf(order, args.output, args.note)
    print(args.output)


if __name__ == "__main__":
    main()
