package server

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"math/rand"
	"net"
	"net/http"
	"net/url"
	"os"
	"path"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"time"

	basicAuth "github.com/abbot/go-http-auth"
	client "github.com/influxdata/usage-client/v1"
	flags "github.com/jessevdk/go-flags"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	idgen "github.com/snetsystems/cloudhub/backend/id"
	"github.com/snetsystems/cloudhub/backend/influx"
	"github.com/snetsystems/cloudhub/backend/kv"
	"github.com/snetsystems/cloudhub/backend/kv/bolt"
	"github.com/snetsystems/cloudhub/backend/kv/etcd"
	clog "github.com/snetsystems/cloudhub/backend/log"
	"github.com/snetsystems/cloudhub/backend/oauth2"
	"github.com/snetsystems/cloudhub/backend/server/config"
)

var (
	startTime time.Time
	errNoAuth = errors.New("no auth configured")
)

func init() {
	startTime = time.Now().UTC()
}

// Server for the CloudHub API
type Server struct {
	Host        string `long:"host" description:"The IP to listen on" default:"0.0.0.0" env:"HOST"`
	Port        int    `long:"port" description:"The port to listen on for insecure connections, defaults to a random value" default:"8888" env:"PORT"`
	DisableGZip bool   `long:"disable-gzip" description:"Disables gzip compression, even if client requests it. Useful if running on a low-cpu device" env:"DISABLE_GZIP"`

	PprofEnabled bool `long:"pprof-enabled" description:"Enable the /debug/pprof/* HTTP routes" env:"PPROF_ENABLED"`

	Cert flags.Filename `long:"cert" description:"Path to PEM encoded public key certificate. " env:"TLS_CERTIFICATE"`
	Key  flags.Filename `long:"key" description:"Path to private key associated with given certificate. " env:"TLS_PRIVATE_KEY"`

	InfluxDBURLs     []string `long:"influxdb-url" description:"Array of the location of your InfluxDB instance" env:"INFLUXDB_URL"`
	InfluxDBUsername string   `long:"influxdb-username" description:"Username for your InfluxDB instance" env:"INFLUXDB_USERNAME"`
	InfluxDBPassword string   `long:"influxdb-password" description:"Password for your InfluxDB instance" env:"INFLUXDB_PASSWORD"`
	InfluxDBOrg      string   `long:"influxdb-org" description:"Organization for your InfluxDB v2 instance" env:"INFLUXDB_ORG"`
	InfluxDBToken    string   `long:"influxdb-token" description:"Token for your InfluxDB v2 instance" env:"INFLUXDB_TOKEN"`

	KapacitorURL      string `long:"kapacitor-url" description:"Location of your Kapacitor instance" env:"KAPACITOR_URL"`
	KapacitorUsername string `long:"kapacitor-username" description:"Username of your Kapacitor instance" env:"KAPACITOR_USERNAME"`
	KapacitorPassword string `long:"kapacitor-password" description:"Password of your Kapacitor instance" env:"KAPACITOR_PASSWORD"`

	Develop            bool          `short:"d" long:"develop" description:"Run server in develop mode."`
	BoltPath           string        `short:"b" long:"bolt-path" description:"Full path to boltDB file (e.g. './cloudhub-v1.db')" env:"BOLT_PATH" default:"cloudhub-v1.db"`
	CannedPath         string        `short:"c" long:"canned-path" description:"Path to directory of pre-canned application layouts (/usr/share/cloudhub/canned)" env:"CANNED_PATH" default:"canned"`
	ProtoboardsPath    string        `long:"protoboards-path" description:"Path to directory of protoboards (/usr/share/cloudhub/protoboards)" env:"PROTOBOARDS_PATH" default:"protoboards"`
	ResourcesPath      string        `long:"resources-path" description:"Path to directory of pre-canned dashboards, sources, kapacitors, and organizations (/usr/share/cloudhub/resources)" env:"RESOURCES_PATH" default:"canned"`
	TokenSecret        string        `short:"t" long:"token-secret" description:"Secret to sign tokens" env:"TOKEN_SECRET"`
	JwksURL            string        `long:"jwks-url" description:"URL that returns OpenID Key Discovery JWKS document." env:"JWKS_URL"`
	UseIDToken         bool          `long:"use-id-token" description:"Enable id_token processing." env:"USE_ID_TOKEN"`
	LoginHint          string        `long:"login-hint" description:"OpenID login_hint paramter to passed to authorization server during authentication" env:"LOGIN_HINT"`
	AuthDuration       time.Duration `long:"auth-duration" default:"720h" description:"Total duration of cookie life for authentication (in hours). 0 means authentication expires on browser close." env:"AUTH_DURATION"`
	InactivityDuration time.Duration `long:"inactivity-duration" default:"5m" description:"Duration for which a token is valid without any new activity." env:"INACTIVITY_DURATION"`

	GithubClientID     string   `short:"i" long:"github-client-id" description:"Github Client ID for OAuth 2 support" env:"GH_CLIENT_ID"`
	GithubClientSecret string   `short:"s" long:"github-client-secret" description:"Github Client Secret for OAuth 2 support" env:"GH_CLIENT_SECRET"`
	GithubOrgs         []string `short:"o" long:"github-organization" description:"Github organization user is required to have active membership (env comma separated)" env:"GH_ORGS" env-delim:","`
	GithubURL          string   `long:"github-url" description:"Github base URL must be specified for Github Enterprise." default:"https://github.com" env:"GH_URL"`

	EtcdEndpoints      []string       `short:"e" long:"etcd-endpoints" description:"List of etcd endpoints" env:"ETCD_ENDPOINTS" env-delim:","`
	EtcdUsername       string         `long:"etcd-username" description:"Username to log into etcd." env:"ETCD_USERNAME"`
	EtcdPassword       string         `long:"etcd-password" description:"Password to log into etcd." env:"ETCD_PASSWORD"`
	EtcdDialTimeout    time.Duration  `long:"etcd-dial-timeout" default:"-1s" description:"Total time to wait before timing out while connecting to etcd endpoints. 0 means no timeout. " env:"ETCD_DIAL_TIMEOUT"`
	EtcdRequestTimeout time.Duration  `long:"etcd-request-timeout" default:"-1s" description:"Total time to wait before timing out the etcd view or update. 0 means no timeout." env:"ETCD_REQUEST_TIMEOUT"`
	EtcdCert           flags.Filename `long:"etcd-cert" description:"Path to PEM encoded TLS public key certificate. " env:"ETCD_CERTIFICATE"`
	EtcdKey            flags.Filename `long:"etcd-key" description:"Path to private key associated with given certificate. " env:"ETCD_PRIVATE_KEY"`
	EtcdRootCA         flags.Filename `long:"etcd-root-ca" description:"File location of root CA cert for TLS verification." env:"ETCD_ROOT_CA"`

	GoogleClientID     string   `long:"google-client-id" description:"Google Client ID for OAuth 2 support" env:"GOOGLE_CLIENT_ID"`
	GoogleClientSecret string   `long:"google-client-secret" description:"Google Client Secret for OAuth 2 support" env:"GOOGLE_CLIENT_SECRET"`
	GoogleDomains      []string `long:"google-domains" description:"Google email domain user is required to have active membership (env comma separated)" env:"GOOGLE_DOMAINS" env-delim:","`

	PublicURL string `long:"public-url" description:"Full public URL used to access CloudHub from a web browser. Used for OAuth2 authentication. (http://localhost:8888)" env:"PUBLIC_URL"`

	HerokuClientID      string   `long:"heroku-client-id" description:"Heroku Client ID for OAuth 2 support" env:"HEROKU_CLIENT_ID"`
	HerokuSecret        string   `long:"heroku-secret" description:"Heroku Secret for OAuth 2 support" env:"HEROKU_SECRET"`
	HerokuOrganizations []string `long:"heroku-organization" description:"Heroku Organization Memberships a user is required to have for access to CloudHub (env comma separated)" env:"HEROKU_ORGS" env-delim:","`

	GenericName         string         `long:"generic-name" description:"Generic OAuth2 name presented on the login page"  env:"GENERIC_NAME"`
	GenericClientID     string         `long:"generic-client-id" description:"Generic OAuth2 Client ID. Can be used own OAuth2 service."  env:"GENERIC_CLIENT_ID"`
	GenericClientSecret string         `long:"generic-client-secret" description:"Generic OAuth2 Client Secret" env:"GENERIC_CLIENT_SECRET"`
	GenericScopes       []string       `long:"generic-scopes" description:"Scopes requested by provider of web client." default:"user:email (env comma separated)" env:"GENERIC_SCOPES" env-delim:","`
	GenericDomains      []string       `long:"generic-domains" description:"Email domain users' email address to have (example.com) (env comma separated)" env:"GENERIC_DOMAINS" env-delim:","`
	GenericAuthURL      string         `long:"generic-auth-url" description:"OAuth 2.0 provider's authorization endpoint URL" env:"GENERIC_AUTH_URL"`
	GenericTokenURL     string         `long:"generic-token-url" description:"OAuth 2.0 provider's token endpoint URL" env:"GENERIC_TOKEN_URL"`
	GenericAPIURL       string         `long:"generic-api-url" description:"URL that returns OpenID UserInfo compatible information." env:"GENERIC_API_URL"`
	GenericAPIKey       string         `long:"generic-api-key" description:"JSON lookup key into OpenID UserInfo. (Azure should be userPrincipalName)" default:"email" env:"GENERIC_API_KEY"`
	GenericInsecure     bool           `long:"generic-insecure" description:"Whether or not to verify auth-url's tls certificates." env:"GENERIC_INSECURE"`
	GenericRootCA       flags.Filename `long:"generic-root-ca" description:"File location of root ca cert for generic oauth tls verification." env:"GENERIC_ROOT_CA"`
	OAuthNoPKCE         bool           `long:"oauth-no-pkce" description:"Disables OAuth PKCE." env:"OAUTH_NO_PKCE"`

	Auth0Domain        string   `long:"auth0-domain" description:"Subdomain of auth0.com used for Auth0 OAuth2 authentication" env:"AUTH0_DOMAIN"`
	Auth0ClientID      string   `long:"auth0-client-id" description:"Auth0 Client ID for OAuth2 support" env:"AUTH0_CLIENT_ID"`
	Auth0ClientSecret  string   `long:"auth0-client-secret" description:"Auth0 Client Secret for OAuth2 support" env:"AUTH0_CLIENT_SECRET"`
	Auth0Organizations []string `long:"auth0-organizations" description:"Auth0 organizations permitted to access CloudHub (env comma separated)" env:"AUTH0_ORGS" env-delim:","`
	Auth0SuperAdminOrg string   `long:"auth0-superadmin-org" description:"Auth0 organization from which users are automatically granted SuperAdmin status" env:"AUTH0_SUPERADMIN_ORG"`

	LoginAuthType string `long:"login-auth-type" description:"Login auth type (mix, oauth, basic)" env:"LOGIN_AUTH_TYPE" default:"oauth"`

	PasswordPolicy        string `long:"password-policy" description:"Regular expression to validate password strength" env:"PASSWORD_POLICY"`
	PasswordPolicyMessage string `long:"password-policy-message" description:"The description about password-policy set" env:"PASSWORD_POLICY_MESSAGE"`

	MailSubject     string `long:"mail-subject" description:"Mail subject" env:"MAIL_SUBJECT"`
	MailBodyMessage string `long:"mail-body-message" description:"Mail body message" env:"MAIL_BODY_MESSAGE"`

	ExternaExec     string `long:"external-exec" description:"External program path" env:"EXTERNAL_EXEC"`
	ExternaExecArgs string `long:"external-exec-args" description:"Arguments of external program" env:"EXTERNAL_EXEC_ARGS"`

	RetryPolicy map[string]string `long:"retry-policy" description:"Login Retry policy. 'count' is the number of login failures. 'delaytime' is the time when login is blocked. 'type' is how to block login. E.g. via flags: '--retry-policy=count:{count} --retry-policy=delaytime:{minute} --retry-policy=type:{lock or delay}'. E.g. via environment variable: 'export RETRY_POLICY=count:{count},delaytime:{minute},type:{lock or delay}'" env:"RETRY_POLICY" env-delim:","`

	StatusFeedURL          string            `long:"status-feed-url" description:"URL of a JSON Feed to display as a News Feed on the client Status page." default:"https://www.snetgroup.info/" env:"STATUS_FEED_URL"`
	CustomLinks            map[string]string `long:"custom-link" description:"Custom link to be added to the client User menu. Multiple links can be added by using multiple of the same flag with different 'name:url' values, or as an environment variable with comma-separated 'name:url' values. E.g. via flags: '--custom-link=snetsystems:https://www.snetsystems.com --custom-link=CloudHub:https://github.com/snetsystems/cloudhub'. E.g. via environment variable: 'export CUSTOM_LINKS=snetsystems:https://www.snetsystems.com,CloudHub:https://github.com/snetsystems/cloudhub'" env:"CUSTOM_LINKS" env-delim:","`
	TelegrafSystemInterval time.Duration     `long:"telegraf-system-interval" default:"1m" description:"Duration used in the GROUP BY time interval for the hosts list" env:"TELEGRAF_SYSTEM_INTERVAL"`
	CustomAutoRefresh      string            `long:"custom-auto-refresh" description:"Adds custom auto refresh options using semicolon separated list of label=milliseconds pairs" env:"CUSTOM_AUTO_REFRESH"`

	ReportingDisabled bool   `short:"r" long:"reporting-disabled" description:"Disable reporting of usage stats (os,arch,version,cluster_id,uptime) once every 24hr" env:"REPORTING_DISABLED"`
	LogLevel          string `short:"l" long:"log-level" value-name:"choice" choice:"debug" choice:"info" choice:"error" default:"info" description:"Set the logging level" env:"LOG_LEVEL"`
	Basepath          string `short:"p" long:"basepath" description:"A URL path prefix under which all CloudHub routes will be mounted. (Note: PREFIX_ROUTES has been deprecated. Now, if basepath is set, all routes will be prefixed with it.)" env:"BASE_PATH"`
	ShowVersion       bool   `short:"v" long:"version" description:"Show CloudHub version info"`
	BuildInfo         cloudhub.BuildInfo

	BasicAuthRealm    string         `long:"basic-auth-realm" default:"Cloudhub" description:"User visible basic authentication realm" env:"BASICAUTH_REALM"`
	BasicAuthHtpasswd flags.Filename `long:"htpasswd" description:"File location of .htpasswd file, turns on HTTP basic authentication when specified." env:"HTPASSWD"`

	TLSCiphers    string `long:"tls-ciphers" description:"Comma-separated list of cipher suites to use. Use 'help' cipher to print available ciphers." env:"TLS_CIPHERS"`
	TLSMinVersion string `long:"tls-min-version" description:"Minimum version of the TLS protocol that will be negotiated." default:"1.2" env:"TLS_MIN_VERSION"`
	TLSMaxVersion string `long:"tls-max-version" description:"Maximum version of the TLS protocol that will be negotiated." env:"TLS_MAX_VERSION"`

	oauthClient http.Client

	AddonURLs   map[string]string `short:"u" long:"addon-url" description:"Support addon is [salt, aws, gcp, osp, k8s, swan, oncue, ipmi-secret-key, ai]. Actually, this is a key-value extensional option not only url but also any key-value. Refer to the following usage samples. E.g., via flags: '-u=salt:{url} -u=salt_config_path:{path} -u=aws:on[off] -u=gcp:on[off] -u=k8s:on[off] -u=swan:{url} -u=oncue:{port number} -u=ipmi-secret-key:{seed key} -u=ai:on[off]'. E.g. via environment variable: 'export ADDON_URL=salt:{url},swan:{url}'" env:"ADDON_URL" env-delim:","`
	AddonTokens map[string]string `short:"k" long:"addon-tokens" description:"The token associated with addon [salt, swan]. E.g. via flags: '-k=salt:{token} -k=swan:{token}'. E.g. via environment variable: 'export ADDON_TOKENS=salt:{token},swan:{token}'" env:"ADDON_TOKENS" env-delim:","`

	OSP map[string]string `long:"osp" description:"The Informations to access to OSP API. '--osp=admin-provider:{salt admin provider} --osp=admin-user:{admin user name} --osp=admin-pw:{admin user password} --osp=auth-url:{keystone url} --osp=pj-domain-id:{project domain id} --osp=user-domain-id:{user domain id}'. E.g. via environment variable: 'export OSP=admin:{salt admin provider},admin-user:{admin user name}', etc." env:"OSP" env-delim:","`

	AI map[string]string `long:"ai" description:"The Information to access to cloudhub AI. '--ai=docker-path:{specifies the path to the Docker Compose file used for restarting the Logstash container} --ai=docker-cmd:{docker restart command} --ai=logstash-path:{The logstash-path variable is used to specify the directory where your Logstash pipeline configuration} --ai=prediction-regex:{parsing tickScript}'. E.g. via environment variable" env:"AI" env-delim:","`

	TemplatesPath string `long:"template-path" description:"Path to directory of config template (/usr/share/cloudhub/cloudhub-templates)" env:"TEMPLATES_PATH" default:"templates"`
}

func provide(p oauth2.Provider, m oauth2.Mux, ok func() error) func(func(oauth2.Provider, oauth2.Mux)) {
	return func(configure func(oauth2.Provider, oauth2.Mux)) {
		if err := ok(); err == nil {
			configure(p, m)
		}
	}
}

// UseGithub validates the CLI parameters to enable github oauth support
func (s *Server) UseGithub() error {
	errMsg := []string{}

	if s.TokenSecret != "" && s.GithubClientID != "" && s.GithubClientSecret != "" {
		return nil
	} else if s.GithubClientID == "" && s.GithubClientSecret == "" {
		return errNoAuth
	}

	if s.TokenSecret == "" {
		errMsg = append(errMsg, "token secret")
	}
	if s.GithubClientID == "" {
		errMsg = append(errMsg, "client id")
	}
	if s.GithubClientSecret == "" {
		errMsg = append(errMsg, "client secret")
	}
	if errMsg != nil {
		return fmt.Errorf("missing Github oauth setting[s]: %s", strings.Join(errMsg, ", "))
	}

	return nil
}

// UseGoogle validates the CLI parameters to enable google oauth support
func (s *Server) UseGoogle() error {
	errMsg := []string{}

	if s.TokenSecret != "" && s.GoogleClientID != "" && s.GoogleClientSecret != "" && s.PublicURL != "" {
		return nil
	} else if s.GoogleClientID == "" && s.GoogleClientSecret == "" {
		return errNoAuth
	}

	if s.TokenSecret == "" {
		errMsg = append(errMsg, "token secret")
	}
	if s.GoogleClientID == "" {
		errMsg = append(errMsg, "client id")
	}
	if s.GoogleClientSecret == "" {
		errMsg = append(errMsg, "client secret")
	}
	if s.PublicURL == "" {
		errMsg = append(errMsg, "public url")
	}
	if errMsg != nil {
		return fmt.Errorf("missing Google oauth setting[s]: %s", strings.Join(errMsg, ", "))
	}

	return nil
}

// UseHeroku validates the CLI parameters to enable heroku oauth support
func (s *Server) UseHeroku() error {
	errMsg := []string{}

	if s.TokenSecret != "" && s.HerokuClientID != "" && s.HerokuSecret != "" {
		return nil
	} else if s.HerokuClientID == "" && s.HerokuSecret == "" {
		return errNoAuth
	}

	if s.TokenSecret == "" {
		errMsg = append(errMsg, "token secret")
	}
	if s.HerokuClientID == "" {
		errMsg = append(errMsg, "client id")
	}
	if s.HerokuSecret == "" {
		errMsg = append(errMsg, "client secret")
	}
	if errMsg != nil {
		return fmt.Errorf("missing Heroku oauth setting[s]: %s", strings.Join(errMsg, ", "))
	}

	return nil
}

// UseAuth0 validates the CLI parameters to enable Auth0 oauth support
func (s *Server) UseAuth0() error {
	errMsg := []string{}

	if s.Auth0ClientID != "" && s.Auth0ClientSecret != "" {
		return nil
	} else if s.Auth0ClientID == "" && s.Auth0ClientSecret == "" {
		return errNoAuth
	}

	if s.Auth0ClientID == "" {
		errMsg = append(errMsg, "client id")
	}
	if s.Auth0ClientSecret == "" {
		errMsg = append(errMsg, "client secret")
	}
	if errMsg != nil {
		return fmt.Errorf("missing Auth0 oauth setting[s]: %s", strings.Join(errMsg, ", "))
	}

	return nil
}

// UseGenericOAuth2 validates the CLI parameters to enable generic oauth support
func (s *Server) UseGenericOAuth2() error {
	errMsg := []string{}

	if s.TokenSecret != "" && s.GenericClientID != "" &&
		s.GenericClientSecret != "" && s.GenericAuthURL != "" &&
		s.GenericTokenURL != "" {
		return nil
	} else if s.GenericClientID == "" && s.GenericClientSecret == "" &&
		s.GenericAuthURL == "" && s.GenericTokenURL == "" {
		return errNoAuth
	}

	if s.TokenSecret == "" {
		errMsg = append(errMsg, "token secret")
	}
	if s.GenericClientID == "" {
		errMsg = append(errMsg, "client id")
	}
	if s.GenericClientSecret == "" {
		errMsg = append(errMsg, "client secret")
	}
	if s.GenericAuthURL == "" {
		errMsg = append(errMsg, "auth url")
	}
	if s.GenericTokenURL == "" {
		errMsg = append(errMsg, "token url")
	}
	if errMsg != nil {
		return fmt.Errorf("missing Generic oauth setting[s]: %s", strings.Join(errMsg, ", "))
	}

	return nil
}

// getCerts gets the read certs from rootPath to the systemCerts.
func getCerts(rootPath string) (*x509.CertPool, error) {
	if rootPath == "" {
		return nil, nil
	}

	f, err := os.Open(rootPath)
	if err != nil {
		return nil, err
	}

	defer f.Close()
	return processCerts(f)
}

func processCerts(rootReader io.Reader) (*x509.CertPool, error) {
	certPool, err := x509.SystemCertPool()
	if err != nil {
		return nil, fmt.Errorf("error using system cert pool: %s", err.Error())
	}

	certs, err := ioutil.ReadAll(rootReader)
	if err != nil {
		return nil, fmt.Errorf("error reading generic root ca: %s", err.Error())
	}

	ok := certPool.AppendCertsFromPEM(certs)
	if !ok {
		return nil, errors.New("error appending cert from root ca")
	}

	return certPool, nil
}
func (s *Server) createCodeExchange() oauth2.CodeExchange {
	return oauth2.NewCodeExchange(!s.OAuthNoPKCE, s.TokenSecret)
}

func (s *Server) githubOAuth(logger cloudhub.Logger, auth oauth2.Authenticator) (oauth2.Provider, oauth2.Mux, func() error) {
	gh := oauth2.Github{
		ClientID:     s.GithubClientID,
		ClientSecret: s.GithubClientSecret,
		Orgs:         s.GithubOrgs,
		BaseURL:      s.GithubURL,
		Logger:       logger,
	}
	jwt := oauth2.NewJWT(s.TokenSecret, s.JwksURL)
	ghMux := oauth2.NewAuthMux(&gh, auth, jwt, s.Basepath, logger, s.UseIDToken, s.LoginHint, &s.oauthClient, s.createCodeExchange())
	return &gh, ghMux, s.UseGithub
}

func (s *Server) googleOAuth(logger cloudhub.Logger, auth oauth2.Authenticator) (oauth2.Provider, oauth2.Mux, func() error) {
	redirectURL := s.PublicURL + s.Basepath + "/oauth/google/callback"
	google := oauth2.Google{
		ClientID:     s.GoogleClientID,
		ClientSecret: s.GoogleClientSecret,
		Domains:      s.GoogleDomains,
		RedirectURL:  redirectURL,
		Logger:       logger,
	}
	jwt := oauth2.NewJWT(s.TokenSecret, s.JwksURL)
	goMux := oauth2.NewAuthMux(&google, auth, jwt, s.Basepath, logger, s.UseIDToken, s.LoginHint, &s.oauthClient, s.createCodeExchange())
	return &google, goMux, s.UseGoogle
}

func (s *Server) herokuOAuth(logger cloudhub.Logger, auth oauth2.Authenticator) (oauth2.Provider, oauth2.Mux, func() error) {
	heroku := oauth2.Heroku{
		ClientID:      s.HerokuClientID,
		ClientSecret:  s.HerokuSecret,
		Organizations: s.HerokuOrganizations,
		Logger:        logger,
	}
	jwt := oauth2.NewJWT(s.TokenSecret, s.JwksURL)
	hMux := oauth2.NewAuthMux(&heroku, auth, jwt, s.Basepath, logger, s.UseIDToken, s.LoginHint, &s.oauthClient, s.createCodeExchange())
	return &heroku, hMux, s.UseHeroku
}

func (s *Server) genericOAuth(logger cloudhub.Logger, auth oauth2.Authenticator) (oauth2.Provider, oauth2.Mux, func() error) {
	gen := oauth2.Generic{
		PageName:       s.GenericName,
		ClientID:       s.GenericClientID,
		ClientSecret:   s.GenericClientSecret,
		RequiredScopes: s.GenericScopes,
		Domains:        s.GenericDomains,
		RedirectURL:    s.genericRedirectURL(),
		AuthURL:        s.GenericAuthURL,
		TokenURL:       s.GenericTokenURL,
		APIURL:         s.GenericAPIURL,
		APIKey:         s.GenericAPIKey,
		Logger:         logger,
	}
	jwt := oauth2.NewJWT(s.TokenSecret, s.JwksURL)
	genMux := oauth2.NewAuthMux(&gen, auth, jwt, s.Basepath, logger, s.UseIDToken, s.LoginHint, &s.oauthClient, s.createCodeExchange())
	return &gen, genMux, s.UseGenericOAuth2
}

func (s *Server) auth0OAuth(logger cloudhub.Logger, auth oauth2.Authenticator) (oauth2.Provider, oauth2.Mux, func() error) {
	redirectPath := path.Join(s.Basepath, "oauth", "auth0", "callback")
	redirectURL, err := url.Parse(s.PublicURL)
	if err != nil {
		logger.Error("Error parsing public URL: err:", err)
		return &oauth2.Auth0{}, &oauth2.AuthMux{}, func() error { return fmt.Errorf("failed to parse public URL: %s", err.Error()) }
	}
	redirectURL.Path = redirectPath

	auth0, err := oauth2.NewAuth0(s.Auth0Domain, s.Auth0ClientID, s.Auth0ClientSecret, redirectURL.String(), s.Auth0Organizations, logger)

	jwt := oauth2.NewJWT(s.TokenSecret, s.JwksURL)
	genMux := oauth2.NewAuthMux(&auth0, auth, jwt, s.Basepath, logger, s.UseIDToken, s.LoginHint, &s.oauthClient, s.createCodeExchange())

	if err != nil {
		logger.Error("Error parsing Auth0 domain: err:", err)
		return &auth0, genMux, func() error { return fmt.Errorf("failed to parse Auth0 domain: %s", err.Error()) }
	}
	return &auth0, genMux, s.UseAuth0
}

func (s *Server) genericRedirectURL() string {
	if s.PublicURL == "" {
		return ""
	}

	genericName := "generic"
	if s.GenericName != "" {
		genericName = s.GenericName
	}

	publicURL, err := url.Parse(s.PublicURL)
	if err != nil {
		return ""
	}

	publicURL.Path = path.Join(publicURL.Path, s.Basepath, "oauth", genericName, "callback")
	return publicURL.String()
}

func (s *Server) useAuth() bool {
	useAuths := []func() error{
		s.UseGithub,
		s.UseGoogle,
		s.UseHeroku,
		s.UseGenericOAuth2,
		s.UseAuth0,
	}

	var err error
	for i := range useAuths {
		switch err = useAuths[i](); err {
		case nil:
			return true
		case errNoAuth:
			continue
		default:
			// If there was an attempt to configure authentication,
			// cloudhub should not disable authentication.
			return true
		}
	}

	return false
}

func (s *Server) validateAuth() error {
	useAuths := []func() error{
		s.UseGithub,
		s.UseGoogle,
		s.UseHeroku,
		s.UseGenericOAuth2,
		s.UseAuth0,
	}

	var errs []string
	for i := range useAuths {
		if err := useAuths[i](); err != nil && err != errNoAuth {
			errs = append(errs, err.Error())
		}
	}

	if !s.useAuth() && s.TokenSecret != "" {
		errs = append(errs, "token secret without oauth config is invalid")
	}

	if len(errs) == 0 {
		return nil
	}

	return errors.New(strings.Join(errs, "; "))
}

func (s *Server) useTLS() bool {
	return s.Cert != ""
}

// NewListener will return an http or https listener depending useTLS().
func (s *Server) NewListener() (net.Listener, error) {
	addr := net.JoinHostPort(s.Host, strconv.Itoa(s.Port))
	if !s.useTLS() {
		listener, err := net.Listen("tcp", addr)
		if err != nil {
			return nil, err
		}
		return listener, nil
	}

	tlsConfig, err := config.CreateTLSConfig(config.TLSOptions{
		Cert:       string(s.Cert),
		Key:        string(s.Key),
		Ciphers:    strings.Split(s.TLSCiphers, ","),
		MinVersion: s.TLSMinVersion,
		MaxVersion: s.TLSMaxVersion,
	})
	if err != nil {
		return nil, err
	}

	listener, err := tls.Listen("tcp", addr, tlsConfig)
	if err != nil {
		return nil, err
	}

	return listener, nil
}

type builders struct {
	Layouts       LayoutBuilder
	Sources       SourcesBuilder
	Kapacitors    KapacitorBuilder
	Dashboards    DashboardBuilder
	Organizations OrganizationBuilder
	Protoboards   ProtoboardsBuilder
}

func (s *Server) newBuilders(logger cloudhub.Logger) builders {
	return builders{
		Layouts: &MultiLayoutBuilder{
			Logger:     logger,
			UUID:       &idgen.UUID{},
			CannedPath: s.CannedPath,
		},
		Dashboards: &MultiDashboardBuilder{
			Logger: logger,
			ID:     idgen.NewTime(),
			Path:   s.ResourcesPath,
		},
		Sources: &MultiSourceBuilder{
			InfluxDBURLs:     s.InfluxDBURLs,
			InfluxDBUsername: s.InfluxDBUsername,
			InfluxDBPassword: s.InfluxDBPassword,
			InfluxDBOrg:      s.InfluxDBOrg,
			InfluxDBToken:    s.InfluxDBToken,
			Logger:           logger,
			ID:               idgen.NewTime(),
			Path:             s.ResourcesPath,
		},
		Kapacitors: &MultiKapacitorBuilder{
			KapacitorURL:      s.KapacitorURL,
			KapacitorUsername: s.KapacitorUsername,
			KapacitorPassword: s.KapacitorPassword,
			Logger:            logger,
			ID:                idgen.NewTime(),
			Path:              s.ResourcesPath,
		},
		Organizations: &MultiOrganizationBuilder{
			Logger: logger,
			Path:   s.ResourcesPath,
		},
		Protoboards: &MultiProtoboardsBuilder{
			Logger:          logger,
			UUID:            &idgen.UUID{},
			ProtoboardsPath: s.ProtoboardsPath,
		},
	}
}

// Serve starts and runs the CloudHub server
func (s *Server) Serve(ctx context.Context) {
	logger := clog.New(clog.ParseLevel(s.LogLevel))
	customLinks, err := NewCustomLinks(s.CustomLinks)
	if err != nil {
		logger.
			WithField("component", "server").
			WithField("CustomLink", "invalid").
			Error(err)
		return
	}

	osp := NewOSP(s.OSP)
	aiConfig := NewAIConfig(s.AI)

	var db kv.Store
	if len(s.EtcdEndpoints) == 0 {
		db, err = bolt.NewClient(ctx,
			bolt.WithPath(s.BoltPath),
			bolt.WithLogger(logger),
			bolt.WithBuildInfo(s.BuildInfo),
		)
		if err != nil {
			logger.Error("Unable to create bolt client", err)
			os.Exit(1)
		}

	} else {
		var tlsConfig *tls.Config
		if s.EtcdCert != "" {
			tlsConfig, err = config.CreateTLSConfig(config.TLSOptions{
				Cert:    string(s.EtcdCert),
				Key:     string(s.EtcdKey),
				CACerts: string(s.EtcdRootCA),
			})
			if err != nil {
				logger.Error("Unable to create TLS configuration for etcd client", err)
				os.Exit(1)
			}
		}

		db, err = etcd.NewClient(ctx,
			etcd.WithEndpoints(s.EtcdEndpoints),
			etcd.WithLogin(s.EtcdUsername, s.EtcdPassword),
			etcd.WithRequestTimeout(s.EtcdRequestTimeout),
			etcd.WithDialTimeout(s.EtcdDialTimeout),
			etcd.WithLogger(logger),
			etcd.WithTLS(tlsConfig),
		)
		if err != nil {
			logger.Error("Unable to create etcd client", err)
			os.Exit(1)
		}
	}

	// no auth
	if !s.useAuth() {
		s.LoginAuthType = ""
	}

	// no kapacitor and no program path
	var basicPasswordResetType string
	if s.KapacitorURL == "" && s.ExternaExec == "" {
		basicPasswordResetType = "admin"
	} else {
		basicPasswordResetType = "all"
	}

	templatesManager := NewConfigTemplatesManager(s.TemplatesPath, logger)

	service := openService(
		ctx,
		db,
		s.newBuilders(logger),
		logger,
		s.useAuth(),
		s.MailSubject,
		s.MailBodyMessage,
		s.ExternaExec,
		s.ExternaExecArgs,
		s.LoginAuthType,
		basicPasswordResetType,
		s.RetryPolicy,
		s.AddonURLs,
		s.AddonTokens,
		osp,
	)
	service.SuperAdminProviderGroups = superAdminProviderGroups{
		auth0: s.Auth0SuperAdminOrg,
	}

	service.Env = cloudhub.Environment{
		TelegrafSystemInterval: s.TelegrafSystemInterval,
		CustomAutoRefresh:      s.CustomAutoRefresh,
	}
	service.InternalENV = cloudhub.InternalEnvironment{
		EtcdEndpoints:    s.EtcdEndpoints,
		TemplatesPath:    s.TemplatesPath,
		TemplatesManager: templatesManager,
		AIConfig:         aiConfig,
	}
	if !validBasepath(s.Basepath) {
		err := fmt.Errorf("invalid basepath, must follow format \"/mybasepath\"")
		logger.
			WithField("component", "server").
			WithField("basepath", "invalid").
			Error(err)
		return
	}

	if err = s.validateAuth(); err != nil {
		logger.
			WithField("component", "server").
			WithField("basepath", "invalid").
			Error(fmt.Errorf("failed to validate Oauth settings: %s", err))
		return
	}

	certs, err := getCerts(string(s.GenericRootCA))
	if err != nil {
		logger.Error(err)
		return
	}

	s.oauthClient = http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: s.GenericInsecure,
				RootCAs:            certs,
			},
		},
	}

	auth := oauth2.NewCookieJWT(s.TokenSecret, s.AuthDuration, s.InactivityDuration)
	providerFuncs := []func(func(oauth2.Provider, oauth2.Mux)){
		provide(s.githubOAuth(logger, auth)),
		provide(s.googleOAuth(logger, auth)),
		provide(s.herokuOAuth(logger, auth)),
		provide(s.genericOAuth(logger, auth)),
		provide(s.auth0OAuth(logger, auth)),
	}

	var basicAuthenticator *basicAuth.BasicAuth
	if !s.useAuth() && len(s.BasicAuthHtpasswd) > 0 {
		logger.
			WithField("component", "server").
			WithField("realm", s.BasicAuthRealm).
			WithField("htpasswd", s.BasicAuthHtpasswd).
			Info("Configuring HTTP basic authentication")
		basicAuthenticator = basicAuth.NewBasicAuthenticator(
			s.BasicAuthRealm,
			basicAuth.HtpasswdFileProvider(string(s.BasicAuthHtpasswd)),
		)
	}

	handler := NewMux(MuxOpts{
		Develop:               s.Develop,
		Auth:                  auth,
		Logger:                logger,
		UseAuth:               s.useAuth(),
		ProviderFuncs:         providerFuncs,
		Basepath:              s.Basepath,
		StatusFeedURL:         s.StatusFeedURL,
		CustomLinks:           customLinks,
		PprofEnabled:          s.PprofEnabled,
		DisableGZip:           s.DisableGZip,
		BasicAuth:             basicAuthenticator,
		PasswordPolicy:        s.PasswordPolicy,
		PasswordPolicyMessage: s.PasswordPolicyMessage,
	}, service)

	// Add CloudHub's version header to all requests
	handler = version(s.BuildInfo.Version, handler)

	if s.useTLS() {
		// Add HSTS to instruct all browsers to change from http to https
		handler = hsts(handler)
	}

	// Using a log writer for http server logging
	w := logger.Writer()
	defer w.Close()
	stdLog := log.New(w, "", 0)

	httpServer := &http.Server{
		ErrorLog:    stdLog,
		Handler:     handler,
		IdleTimeout: 5 * time.Second,
	}
	httpServer.SetKeepAlivesEnabled(true)

	// Not in cloudhub
	// if !s.ReportingDisabled {
	// 	go reportUsageStats(s.BuildInfo, logger)
	// }
	scheme := "http"
	if s.useTLS() {
		scheme = "https"
	}

	listener, err := s.NewListener()
	if err != nil {
		logger.
			WithField("component", "server").
			Error(err)
		return
	}
	defer listener.Close()

	logger.
		WithField("component", "server").
		Info("Serving cloudhub at ", scheme, "://", listener.Addr())

	if _, err := service.IsMinionAvailable("osp"); err != nil {
		logger.
			WithField("component", "server").
			Error(err)
		return
	}
	if _, ok := s.AddonURLs["ai"]; ok {
		if aiConfig.DockerCmd == "" || aiConfig.DockerPath == "" || aiConfig.LogstashPath == "" || aiConfig.PredictionRegex == "" {
			logger.
				WithField("component", "server").
				Error(errors.New("AI option is enabled but configuration is invalid"))
			return
		}

	}

	if err := httpServer.Serve(listener); err != nil {
		logger.
			WithField("component", "server").
			Error(err)
		return
	}

	logger.
		WithField("component", "server").
		Info("Stopped serving cloudhub at ", scheme, "://", listener.Addr())
}

func openService(
	ctx context.Context,
	db kv.Store,
	builder builders,
	logger cloudhub.Logger,
	useAuth bool,
	mailSubject,
	mailBody,
	externalExec,
	externalExecArgs string,
	loginAuthType string,
	basicPasswordResetType string,
	retryPolicy map[string]string,
	addonURLs map[string]string,
	addonTokens map[string]string,
	osp OSP,
) Service {

	svc, err := kv.NewService(ctx, db, kv.WithLogger(logger))
	if err != nil {
		logger.Error("Unable to create kv service", err)
		os.Exit(1)
	}

	dashboards, err := builder.Dashboards.Build(svc.DashboardsStore())
	if err != nil {
		logger.
			WithField("component", "DashboardsStore").
			Error("Unable to construct a MultiDashboardsStore", err)
		os.Exit(1)
	}

	organizations, err := builder.Organizations.Build(svc.OrganizationsStore())
	if err != nil {
		logger.
			WithField("component", "OrganizationsStore").
			Error("Unable to construct a MultiOrganizationStore", err)
		os.Exit(1)
	}

	kapacitors, err := builder.Kapacitors.Build(svc.ServersStore())
	if err != nil {
		logger.
			WithField("component", "KapacitorStore").
			Error("Unable to construct a MultiKapacitorStore", err)
		os.Exit(1)
	}

	sources, err := builder.Sources.Build(svc.SourcesStore())
	if err != nil {
		logger.
			WithField("component", "SourcesStore").
			Error("Unable to construct a MultiSourcesStore", err)
		os.Exit(1)
	}

	protoboards, err := builder.Protoboards.Build()
	if err != nil {
		logger.
			WithField("component", "Protoboards").
			Error("Unable to construct a MultiLayoutsStore", err)
		os.Exit(1)
	}

	layouts, err := builder.Layouts.Build()
	if err != nil {
		logger.
			WithField("component", "LayoutsStore").
			Error("Unable to construct a MultiLayoutsStore", err)
		os.Exit(1)
	}

	return Service{
		TimeSeriesClient: &InfluxClient{},
		Store: &Store{
			LayoutsStore:            layouts,
			DashboardsStore:         dashboards,
			SourcesStore:            sources,
			ServersStore:            kapacitors,
			OrganizationsStore:      organizations,
			ProtoboardsStore:        protoboards,
			UsersStore:              svc.UsersStore(),
			ConfigStore:             svc.ConfigStore(),
			MappingsStore:           svc.MappingsStore(),
			OrganizationConfigStore: svc.OrganizationConfigStore(),
			VspheresStore:           svc.VspheresStore(),
			TopologiesStore:         svc.TopologiesStore(),
			CSPStore:                svc.CSPStore(),
			NetworkDeviceStore:      svc.NetworkDeviceStore(),
			NetworkDeviceOrgStore:   svc.NetworkDeviceOrgStore(),
			MLNxRstStore:            svc.MLNxRstStore(),
			DLNxRstStore:            svc.DLNxRstStore(),
			DLNxRstStgStore:         svc.DLNxRstStgStore(),
		},
		Logger:                 logger,
		UseAuth:                useAuth,
		Databases:              &influx.Client{Logger: logger},
		MailSubject:            mailSubject,
		MailBody:               mailBody,
		ExternalExec:           externalExec,
		ExternalExecArgs:       externalExecArgs,
		LoginAuthType:          loginAuthType,
		BasicPasswordResetType: basicPasswordResetType,
		RetryPolicy:            retryPolicy,
		AddonURLs:              addonURLs,
		AddonTokens:            addonTokens,
		OSP:                    osp,
	}
}

// reportUsageStats starts periodic server reporting.
func reportUsageStats(bi cloudhub.BuildInfo, logger cloudhub.Logger) {
	rand.Seed(time.Now().UTC().UnixNano())
	serverID := strconv.FormatUint(uint64(rand.Int63()), 10)
	reporter := client.New("")
	values := client.Values{
		"os":         runtime.GOOS,
		"arch":       runtime.GOARCH,
		"version":    bi.Version,
		"cluster_id": serverID,
		"uptime":     time.Since(startTime).Seconds(),
	}
	l := logger.WithField("component", "usage").
		WithField("reporting_addr", reporter.URL).
		WithField("freq", "24h").
		WithField("stats", "os,arch,version,cluster_id,uptime")
	l.Info("Reporting usage stats")
	reporter.Save(clientUsage(values))

	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()
	for {
		<-ticker.C
		values["uptime"] = time.Since(startTime).Seconds()
		l.Debug("Reporting usage stats")
		go reporter.Save(clientUsage(values))
	}
}

func clientUsage(values client.Values) *client.Usage {
	return &client.Usage{
		Product: "cloudhub-ng",
		Data: []client.UsageData{
			{
				Values: values,
			},
		},
	}
}

var re = regexp.MustCompile(`(\/{1}[\w-]+)+`)

func validBasepath(basepath string) bool {
	return re.ReplaceAllLiteralString(basepath, "") == ""
}
