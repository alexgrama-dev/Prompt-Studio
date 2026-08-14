import unittest

from add import add


class AddTests(unittest.TestCase):
    def test_adds_two_numbers(self) -> None:
        self.assertEqual(add(2, 2), 4)


if __name__ == "__main__":
    unittest.main()
