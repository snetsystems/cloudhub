package server

// snetSymbolPNG is frontend/assets/images/snet_symbolmark00.png — the SNet
// Systems mark the sidebar already wears — resampled to 128px and base64'd.
//
// It rides inside the expiry notice because an expired server refuses asset
// requests as well, so the page cannot fetch the real file. Regenerate with:
//
//	python3 -c "from PIL import Image; import base64, io; \
//	  b=io.BytesIO(); \
//	  Image.open('frontend/assets/images/snet_symbolmark00.png').convert('RGBA') \
//	    .resize((128,128), Image.LANCZOS).save(b,'PNG',optimize=True); \
//	  print(base64.b64encode(b.getvalue()).decode())"
const snetSymbolPNG = "" +
	"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" +
	"AABJRU5ErkJggg=="
