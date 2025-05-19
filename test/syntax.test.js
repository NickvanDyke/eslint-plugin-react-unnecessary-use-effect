import { MyRuleTester, js } from "./rule-tester.js";
import { messageIds } from "../src/messages.js";

// TODO: Should maybe do away with this... it helps writing but not readable
const code = ({
  componentDeclaration = js`const DoubleCounter = () =>`,
  effectBody = js`setDoubleCount(count * 2)`,
  effectDeps = js`[count]`,
}) => js`
  ${componentDeclaration} {
    const [count, setCount] = useState(0);
    const [doubleCount, setDoubleCount] = useState(0);

    useEffect(() => ${effectBody}, ${effectDeps});

    return (
      <div>
        <p>Count: {count}</p>
        <p>Double Count: {doubleCount}</p>
      </div>
    );
  }
`;

// Syntax variations that are semantically equivalent
// TODO: Could dynamically generate variations: https://mochajs.org/#dynamically-generating-tests
// Could be overkill; they shouldn't affect each other (supposedly, but I guess that's the point of tests!)
new MyRuleTester().run("/syntax", {
  valid: [
    {
      name: "Empty effect",
      code: js`
        function Component() {
          useEffect(() => {}, []);
        }
      `,
    },
    {
      name: "Two components with overlapping names",
      // Not a super realistic example
      code: js`
        function ComponentOne() {
          const [data, setData] = useState();
        }

        function ComponentTwo() {
          const setData = (data) => {
            console.log(data);
          }

          useEffect(() => {
            setData('hello');
          }, []);
        }
      `,
    },
    {
      // TODO: We don't follow functions right now
      name: "Passing non-anonymous function to effect",
      code: js`
        function Form({ onClose }) {
          const [name, setName] = useState();
          const [isOpen, setIsOpen] = useState(true);

          useEffect(onClose, [isOpen]);
        }
      `,
    },
    {
      name: "Variable name shadows state name",
      code: js`
        function CountrySelect({ translation }) {
          const [countries, setCountries] = useState();

          useEffect(() => {
            // Verify that the shadowing variable is not considered a state ref
            const countries = getCountries(translation);
            setCountries(countries);
          },
            // Important to the test: Leads us to check useState initializers,
            // so we can verify that we don't try to find a useState for the shadowing variable
            [translation]
          );
        }
      `,
    },
    {
      name: "Member call expression side effect without args",
      code: code({
        effectBody: js`
            {
              const value = someObject.someMethod();
              setDoubleCount(value * count);
            }
          `,
      }),
    },
    {
      name: "Member call expression side effect with args",
      code: code({
        effectBody: js`
            {
              const value = someObject.someMethod(count);
              setDoubleCount(value);
            }
          `,
      }),
    },
    {
      name: "Reacting to external state changes with member access in deps",
      code: js`
        function Feed() {
          const { data } = useQuery('/posts');
          const [scrollPosition, setScrollPosition] = useState(0);

          useEffect(() => {
            setScrollPosition(0);
          }, [data.posts]);
        }
      `,
    },
    {
      name: "Destructured array skips element in arrow function params",
      code: js`
        function FilteredPosts({ posts }) {
          const [filteredPosts, setFilteredPosts] = useState([]);

          useEffect(() => {
            // Resulting AST node looks like:
            // {
            //   "type": "ArrayPattern",
            //   "elements": [
            //     null, <-- Must handle this!
            //     {
            //       "type": "Identifier",
            //       "name": "second"
            //     }
            //   ]
            // }
            setFilteredPosts(
              posts.filter(([, value]) => value !== "")
            );
          }, [posts]);
        }
      `,
    },
  ],
  invalid: [
    {
      name: "Function component",
      code: code({
        componentDeclaration: js`function DoubleCounter()`,
      }),
      errors: 2,
    },
    {
      name: "Arrow function component",
      code: code({
        componentDeclaration: js`const DoubleCounter = () =>`,
      }),
      errors: 2,
    },
    {
      name: "Effect one-liner body",
      code: code({
        componentDeclaration: js`const AvoidDuplicateTest = () =>`,
        effectBody: js`setDoubleCount(count * 2)`,
      }),
      errors: 2,
    },
    {
      name: "Effect single-statement body",
      code: code({
        effectBody: js`{ setDoubleCount(count * 2); }`,
      }),
      errors: 2,
    },
    {
      name: "Effect multi-statement body",
      code: code({
        effectBody: js`{ setDoubleCount(count * 2); setDoubleCount(count * 2); }`,
      }),
      errors: 3,
    },
    {
      name: "React.useEffect",
      code: js`
          function DoubleCounter() {
            const [count, setCount] = useState(0);
            const [doubleCount, setDoubleCount] = useState(0);

            React.useEffect(() => {
              setDoubleCount(count * 2);
            }, [count]);
          }
        `,
      errors: 2,
    },
    {
      name: "Non-destructured props",
      code: code({
        componentDeclaration: js`function DoubleCounter(props)`,
        effectBody: js`setDoubleCount(props.count * 2)`,
        effectDeps: js`[props.count]`,
      }),
      errors: 2,
    },
    {
      name: "Destructured props",
      code: code({
        componentDeclaration: js`function DoubleCounter({ propCount })`,
        effectBody: js`setDoubleCount(propCount * 2)`,
        effectDeps: js`[propCount]`,
      }),
      errors: 2,
    },
    {
      name: "Renamed destructured props",
      code: code({
        componentDeclaration: js`function DoubleCounter({ count: countProp })`,
        effectBody: js`setDoubleCount(countProp * 2)`,
        effectDeps: js`[countProp]`,
      }),
      errors: 2,
    },
    {
      name: "Doubly deep MemberExpression in effect",
      code: code({
        componentDeclaration: js`function DoubleCounter(props)`,
        effectBody: js`setDoubleCount(props.nested.count * 2)`,
        effectDeps: js`[props.nested.count]`,
      }),
      errors: 2,
    },
    {
      name: "Objects stored in state",
      code: js`
          function DoubleCounter() {
            const [count, setCount] = useState({ value: 0 });
            const [doubleCount, setDoubleCount] = useState({ value: 0 });

            useEffect(() => {
              setDoubleCount({ value: count.value * 2 });
            }, [count]);
          }
        `,
      errors: 2,
    },
    {
      name: "Optional chaining and nullish coalescing",
      code: js`
        function DoubleCounter({ count }) {
          const [doubleCount, setDoubleCount] = useState(0);

          useEffect(() => {
            setDoubleCount((count?.value ?? 1) * 2);
          }, [count?.value]);
        }
      `,
      errors: 2,
    },
    {
      // `exhaustive-deps` doesn't enforce member access in the deps
      name: "Member access in effect body but not in deps",
      code: code({
        componentDeclaration: js`function DoubleCounter(props)`,
        effectBody: js`setDoubleCount(props.count * 2)`,
        effectDeps: js`[props]`,
      }),
      errors: 2,
    },
    {
      name: "Doubly nested scopes in effect body",
      code: code({
        effectBody: js`
            {
              if (count > 10) {
                if (count > 100) {
                  setDoubleCount(count * 4);
                } else {
                  setDoubleCount(count * 2);
                }
              } else {
                setDoubleCount(count);
              }
            }
          `,
      }),
      errors: 4,
    },
    {
      name: "Destructured array skips element in variable declaration",
      code: js`
        function SecondPost({ posts }) {
          const [secondPost, setSecondPost] = useState();

          useEffect(() => {
            const [, second] = posts;
            setSecondPost(second);
          }, [posts]);
        }
      `,
      errors: 2,
    },
  ],
});
