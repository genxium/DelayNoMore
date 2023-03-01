package resolv

import (
	"math"
)

// Vector is the definition of a row vector that contains scalars as
// 64 bit floats
type Vector []float64

// Axis is an integer enum type that describes vector axis
type Axis int

const (
	// the consts below are used to represent vector axis, they are useful
	// to lookup values within the vector.
	X Axis = iota
	Y
	Z
)

// Clone a vector
func Clone(v Vector) Vector {
	return v.Clone()
}

// Clone a vector
func (v Vector) Clone() Vector {
	clone := make(Vector, len(v))
	copy(clone, v)
	return clone
}

// Magnitude of a vector
func Magnitude(v Vector) float64 {
	return v.Magnitude()
}

// Magnitude of a vector
func (v Vector) Magnitude() float64 {
	return math.Sqrt(v.Magnitude2())
}

func (v Vector) Magnitude2() float64 {
	var result float64

	for _, scalar := range v {
		result += scalar * scalar
	}

	return result
}

// Unit returns a direction vector with the length of one.
func Unit(v Vector) Vector {
	return v.Clone().Unit()
}

// Unit returns a direction vector with the length of one.
func (v Vector) Unit() Vector {
	l := v.Magnitude()

	if l < 1e-8 {
		return v
	}

	for i := 0; i < len(v); i++ {
		v[i] = v[i] / l
	}

	return v
}

// X is corresponding to doing a v[0] lookup, if index 0 does not exist yet, a
// 0 will be returned instead
func (v Vector) X() float64 {
	if len(v) < 1 {
		return 0.
	}

	return v[X]
}

// Y is corresponding to doing a v[1] lookup, if index 1 does not exist yet, a
// 0 will be returned instead
func (v Vector) Y() float64 {
	if len(v) < 2 {
		return 0.
	}

	return v[Y]
}

// Z is corresponding to doing a v[2] lookup, if index 2 does not exist yet, a
// 0 will be returned instead
func (v Vector) Z() float64 {
	if len(v) < 3 {
		return 0.
	}

	return v[Z]
}
