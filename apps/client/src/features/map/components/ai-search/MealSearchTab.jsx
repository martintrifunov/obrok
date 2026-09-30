import {
  Box,
  Chip,
  Divider,
  FormControlLabel,
  Switch,
  Typography,
  useTheme,
} from "@mui/material";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import SearchInputBar from "./SearchInputBar";
import MealMarketCard from "./MealMarketCard";
import { SearchMessage, SearchSpinner } from "./SearchStatus";

const MealSearchTab = ({
  input,
  onInputChange,
  query,
  isLoading,
  error,
  result,
  weeklyBudget,
  budgetOnly,
  onBudgetOnlyChange,
  onDistanceClick,
}) => {
  const theme = useTheme();

  let content;
  if (!query) {
    content = (
      <SearchMessage variant="body2">
        Внеси оброк, а ние ќе ги најдеме потребните состојки и каде се
        најисплатливи.
      </SearchMessage>
    );
  } else if (isLoading) {
    content = <SearchSpinner />;
  } else if (error?.status === 429) {
    content = (
      <SearchMessage>
        Премногу пребарувања за кратко време. Обиди се повторно за една минута.
      </SearchMessage>
    );
  } else if (result?.redirect) {
    content = (
      <SearchMessage>
        Не успеавме да го разложиме пребарувањето во јасна листа на состојки.
        <br />
        Обиди се со поконкретен оброк (пример: „палачинки“, „шопска салата“)
        или користи го табот &quot;Пребарување&quot;.
      </SearchMessage>
    );
  } else if (!result?.data) {
    content = <SearchMessage>Нема резултати за &quot;{query}&quot;.</SearchMessage>;
  } else {
    const { shoppingList, markets } = result.data;
    content = (
      <Box display="flex" flexDirection="column" gap={2}>
        <Box>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Листа на производи
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {shoppingList.map((item) => (
              <Chip
                key={item.name}
                icon={item.found ? <CheckCircleIcon /> : <CancelIcon />}
                label={item.name}
                size="small"
                color={item.found ? "success" : "error"}
                variant="outlined"
                sx={{ borderRadius: 1 }}
              />
            ))}
          </Box>
        </Box>

        <Divider />

        <Typography variant="subtitle2" fontWeight="bold">
          Маркети
        </Typography>
        {markets.length === 0 ? (
          <SearchMessage py={2}>Нема маркети со овие производи.</SearchMessage>
        ) : (
          markets.map((entry) => (
            <MealMarketCard
              key={entry.market._id}
              entry={entry}
              onDistanceClick={onDistanceClick}
            />
          ))
        )}
      </Box>
    );
  }

  return (
    <>
      <SearchInputBar
        value={input}
        onChange={onInputChange}
        placeholder="Внеси оброк што ти се јаде..."
        icon={<ShoppingCartIcon color="primary" sx={{ mr: 1 }} />}
      />

      <Box
        sx={{
          px: 2,
          py: 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: theme.palette.action.hover,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography variant="body2" fontWeight="bold">
          Буџет за оброк: {weeklyBudget != null ? `${weeklyBudget} ден.` : "—"}
        </Typography>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={budgetOnly}
              onChange={(e) => onBudgetOnlyChange(e.target.checked)}
            />
          }
          label={<Typography variant="caption">Само во буџет</Typography>}
          sx={{ mr: 0 }}
        />
      </Box>

      <Box sx={{ flexGrow: 1, overflowY: "auto", p: 2 }}>{content}</Box>
    </>
  );
};

export default MealSearchTab;
