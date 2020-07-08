package server

import (
	"log"
	"net/http"
	"encoding/json"
	"os"
	// "path/filepath"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

var assetsDir = "public"

// WebsocketHandler socket Handler
func (s *Service) WebsocketHandler (w http.ResponseWriter, r *http.Request){
	c, err := upgrader.Upgrade(w, r, nil)
   if err != nil {
      log.Print("upgrade:", err)
      return
   }
   defer c.Close()
   acceptLanguage := os.Getenv("ACCEPT_LANGUAGE")

   log.Print("acceptLanguage:", acceptLanguage)
   for {
      mt, message, err := c.ReadMessage()
      if err != nil {
         log.Println("read:", err)
         break
      }
      var objmap map[string]interface{}
      _ = json.Unmarshal(message, &objmap)
      event := objmap["event"].(string)
      sendData := map[string]interface{}{
         "event": "res",
         "data":  nil,
      }
      switch event {
      case "open":
         log.Printf("Received: %s\n", event)
      case "req":
         sendData["data"] = objmap["data"]
         log.Printf("Received: %s\n", event)
      }
      refineSendData, err := json.Marshal(sendData)
      err = c.WriteMessage(mt, refineSendData)
      if err != nil {
         log.Println("write:", err)
         break
      }
   }
}

// func getAssetsDir() string {
// 	path, err := os.Executable()
// 	if err != nil {
// 		log.Fatalf("Error determining path to executable: %#v", err) 
// 	}
//    path, err = filepath.EvalSymlinks(path)

//    if err != nil {
// 	log.Fatalf("Error evaluating symlinks for path '%s': %#v", path, err)
// 	}

// 	return filepath.Join(filepath.Dir(path), assetsDir)
// }

// func getLocaleDir(locale string) string {
// 	localeDir := ""
// 	assetsDir := getAssetsDir()
// 	tags, _, _ := language.ParseAcceptLanguage(locale)
// 	localeMap := handler.getLocaleMap()

// 	for _, tag := range tags {
// 		if _, exists := localeMap[tag.String()]; exists {
// 			localeDir = filepath.Join(assetsDir, tag.String())
// 			break
// 		}
// 	}

// 	if handler.dirExists(localeDir) {
// 		return localeDir
// 	}

// 	return filepath.Join(assetsDir, defaultLocaleDir)
// }

// func determineLocalizedDir(locale string) string {
// 	// TODO(floreks): Remove that once new locale codes are supported by the browsers.
// 	// For backward compatibility only.
// 	localeMap := strings.NewReplacer(
// 		"zh-CN", "zh-Hans",
// 		"zh-cn", "zh-Hans",
// 		"zh-TW", "zh-Hant",
// 		"zh-tw", "zh-Hant",
// 		"zh-hk", "zh-Hant-HK",
// 		"zh-HK", "zh-Hant-HK",
// 	)

// 	return handler.getLocaleDir(localeMap.Replace(locale))
// }

