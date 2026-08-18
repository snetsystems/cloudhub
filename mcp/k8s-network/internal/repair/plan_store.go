package repair

import (
	"crypto/rand"
	"errors"
	"fmt"
	"sync"
	"time"
)

var (
	ErrPlanNotFound   = errors.New("plan_not_found")
	ErrPlanExpired    = errors.New("plan_expired")
	ErrPlanUsed       = errors.New("plan_used")
	ErrPlanInProgress = errors.New("plan_in_progress")
)

type ApplyResult struct {
	PlanID          string `json:"planId"`
	Namespace       string `json:"namespace"`
	PolicyName      string `json:"policyName"`
	PreviousPort    int32  `json:"previousPort"`
	CurrentPort     int32  `json:"currentPort"`
	ResourceVersion string `json:"resourceVersion"`
}

type Plan struct {
	ID              string
	Namespace       string
	PolicyName      string
	CurrentPort     int32
	DesiredPort     int32
	ResourceVersion string
	ExpiresAt       time.Time
	Used            bool
	IdempotencyKey  string
	Result          *ApplyResult
}

type PlanStore struct {
	mu    sync.Mutex
	plans map[string]*Plan
	ttl   time.Duration
	now   func() time.Time
}

func NewPlanStore(ttl time.Duration, now func() time.Time) *PlanStore {
	if now == nil {
		now = time.Now
	}
	return &PlanStore{
		plans: make(map[string]*Plan),
		ttl:   ttl,
		now:   now,
	}
}

func (s *PlanStore) Create(plan Plan) Plan {
	s.mu.Lock()
	defer s.mu.Unlock()

	plan.ID = newPlanID()
	plan.ExpiresAt = s.now().Add(s.ttl)
	plan.Used = false
	plan.IdempotencyKey = ""
	plan.Result = nil
	s.plans[plan.ID] = clonePlan(plan)
	return plan
}

func (s *PlanStore) Get(id string) (Plan, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	plan, err := s.getLocked(id)
	if err != nil {
		return Plan{}, err
	}
	return *clonePlan(*plan), nil
}

func (s *PlanStore) BeginApply(id, idempotencyKey string) (Plan, *ApplyResult, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	plan, err := s.getLocked(id)
	if err != nil {
		return Plan{}, nil, err
	}
	if plan.Used {
		if plan.IdempotencyKey != idempotencyKey {
			return Plan{}, nil, ErrPlanUsed
		}
		if plan.Result == nil {
			return Plan{}, nil, ErrPlanInProgress
		}
		result := *plan.Result
		return *clonePlan(*plan), &result, nil
	}

	plan.Used = true
	plan.IdempotencyKey = idempotencyKey
	return *clonePlan(*plan), nil, nil
}

func (s *PlanStore) FinishApply(id, idempotencyKey string, result ApplyResult) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	plan, err := s.getLocked(id)
	if err != nil {
		return err
	}
	if !plan.Used || plan.IdempotencyKey != idempotencyKey || plan.Result != nil {
		return ErrPlanUsed
	}
	resultCopy := result
	plan.Result = &resultCopy
	return nil
}

func (s *PlanStore) getLocked(id string) (*Plan, error) {
	plan, ok := s.plans[id]
	if !ok {
		return nil, ErrPlanNotFound
	}
	if !s.now().Before(plan.ExpiresAt) {
		return nil, ErrPlanExpired
	}
	return plan, nil
}

func clonePlan(plan Plan) *Plan {
	if plan.Result != nil {
		result := *plan.Result
		plan.Result = &result
	}
	return &plan
}

func newPlanID() string {
	var value [16]byte
	if _, err := rand.Read(value[:]); err != nil {
		panic(fmt.Sprintf("generate plan ID: %v", err))
	}
	value[6] = (value[6] & 0x0f) | 0x40
	value[8] = (value[8] & 0x3f) | 0x80
	return fmt.Sprintf(
		"%08x-%04x-%04x-%04x-%012x",
		value[0:4],
		value[4:6],
		value[6:8],
		value[8:10],
		value[10:16],
	)
}
