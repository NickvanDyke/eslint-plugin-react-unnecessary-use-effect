import { ruleTester } from "./rule-tester.js";
import { rule } from "../src/rule.js";
const js = String.raw;

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
ruleTester.run(
  "you-might-not-need-an-effect/syntax-variations",
  rule,
  {
    valid: [
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
        name: "Arbitrarily deep member access in effect",
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

            return (
              <div>
                <p>Count: {count.value}</p>
                <p>Double Count: {doubleCount.value}</p>
              </div>
            );
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
        name: "Arbitrarily deep nested scopes in effect body",
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
    ],
  },
);
