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

/*
// Add a vector with a vector or a set of vectors
func Add(v1 Vector, vs ...Vector) Vector {
	return v1.Clone().Add(vs...)
}

// Add a vector with a vector or a set of vectors
func (v Vector) Add(vs ...Vector) Vector {
	dim := len(v)

	for i := range vs {
		if len(vs[i]) > dim {
			axpyUnitaryTo(v, 1, v, vs[i][:dim])
		} else {
			axpyUnitaryTo(v, 1, v, vs[i])
		}
	}

	return v
}

// Sub subtracts a vector with another vector or a set of vectors
func Sub(v1 Vector, vs ...Vector) Vector {
	return v1.Clone().Sub(vs...)
}

// Sub subtracts a vector with another vector or a set of vectors
func (v Vector) Sub(vs ...Vector) Vector {
	dim := len(v)

	for i := range vs {
		if len(vs[i]) > dim {
			axpyUnitaryTo(v, -1, vs[i][:dim], v)
		} else {
			axpyUnitaryTo(v, -1, vs[i], v)
		}
	}

	return v
}

// Scale vector with a given size
func Scale(v Vector, size float64) Vector {
	return v.Clone().Scale(size)
}

// Scale vector with a given size
func (v Vector) Scale(size float64) Vector {
	scalUnitaryTo(v, size, v)
	return v
}
*/

// Equal compares that two vectors are equal to each other
func Equal(v1, v2 Vector) bool {
	return v1.Equal(v2)
}

// Equal compares that two vectors are equal to each other
func (v Vector) Equal(v2 Vector) bool {
	if len(v) != len(v2) {
		return false
	}

	for i := range v {
		if math.Abs(v[i]-v2[i]) > 1e-8 {
			return false
		}
	}

	return true
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

	for i := range v {
		v[i] = v[i] / l
	}

	return v
}

// Dot product of two vectors
func Dot(v1, v2 Vector) float64 {
	result, dim1, dim2 := 0., len(v1), len(v2)

	if dim1 > dim2 {
		v2 = append(v2, make(Vector, dim1-dim2)...)
	}

	if dim1 < dim2 {
		v1 = append(v1, make(Vector, dim2-dim1)...)
	}

	for i := range v1 {
		result += v1[i] * v2[i]
	}

	return result
}

// Dot product of two vectors
func (v Vector) Dot(v2 Vector) float64 {
	return Dot(v, v2)
}

// Cross product of two vectors
func Cross(v1, v2 Vector) Vector {
	return v1.Cross(v2)
}

// Cross product of two vectors
func (v Vector) Cross(v2 Vector) Vector {
	if len(v) != 3 || len(v2) != 3 {
		return nil
	}

	return Vector{
		v[Y]*v2[Z] - v[Z]*v2[Y],
		v[Z]*v2[X] - v[X]*v2[Z],
		v[X]*v2[Z] - v[Z]*v2[X],
	}
}

// Rotate is rotating a vector around a specified axis.
// If no axis are specified, it will default to the Z axis.
//
// If a vector with more than 3-dimensions is rotated, it will cut the extra
// dimensions and return a 3-dimensional vector.
//
// NOTE: the ...Axis is just syntactic sugar that allows the axis to not be
// specified and default to Z, if multiple axis is passed the first will be
// set as the rotation axis
func Rotate(v Vector, angle float64, as ...Axis) Vector {
	return v.Clone().Rotate(angle, as...)
}

// Rotate is rotating a vector around a specified axis.
// If no axis are specified, it will default to the Z axis.
//
// If a vector with more than 3-dimensions is rotated, it will cut the extra
// dimensions and return a 3-dimensional vector.
//
// NOTE: the ...Axis is just syntactic sugar that allows the axis to not be
// specified and default to Z, if multiple axis is passed the first will be
// set as the rotation axis
func (v Vector) Rotate(angle float64, as ...Axis) Vector {
	axis, dim := Z, len(v)

	if dim == 0 {
		return v
	}

	if len(as) > 0 {
		axis = as[0]
	}

	if dim == 1 && axis != Z {
		v = append(v, 0, 0)
	}

	if (dim < 2 && axis == Z) || (dim == 2 && axis != Z) {
		v = append(v, 0)
	}

	x, y := v[X], v[Y]

	cos, sin := math.Cos(angle), math.Sin(angle)

	switch axis {
	case X:
		z := v[Z]
		v[Y] = y*cos - z*sin
		v[Z] = y*sin + z*cos
	case Y:
		z := v[Z]
		v[X] = x*cos + z*sin
		v[Z] = -x*sin + z*cos
	case Z:
		v[X] = x*cos - y*sin
		v[Y] = x*sin + y*cos
	}

	if dim > 3 {
		return v[:3]
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
