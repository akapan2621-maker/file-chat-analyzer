import "../styles/globals.css";

type Props = {
  children: React.ReactNode;
};

export default function App({ children }: Props) {
  return <>{children}</>;
}
