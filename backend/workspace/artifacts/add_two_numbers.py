"""Module that provides a simple function to add two numbers.

The function accepts any numeric types that support the ``+`` operator.
It returns the sum of the two arguments.

Example usage:
>>> from add_two_numbers import add
>>> add(2, 3)
5
"""

from typing import Union

Number = Union[int, float]


def add(a: Number, b: Number) -> Number:
    """Return the sum of *a* and *b*.

    Parameters
    ----------
    a, b : int or float
        Numbers to be added.

    Returns
    -------
    int or float
        The result of ``a + b``.
    """
    return a + b

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Add two numbers.")
    parser.add_argument("a", type=float, help="First number")
    parser.add_argument("b", type=float, help="Second number")
    args = parser.parse_args()
    print(add(args.a, args.b))
