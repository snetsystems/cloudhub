package kapacitor

// ErrNotChronoTickscript signals a TICKscript that cannot be parsed into
// CloudHub data structure.
const ErrNotChronoTickscript = Error("TICKscript not built with CloudHub builder")

// Error are kapacitor errors due to communication or processing of TICKscript to kapacitor
type Error string

func (e Error) Error() string {
	return string(e)
}
