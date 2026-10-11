import { useEffect, useRef, useState, type CompositionEvent } from "react";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import { Autocomplete, Box, InputAdornment, Stack, TextField, Typography } from "@mui/material";

export function CatalogSearch<Option extends { key: string; label: string }>({
  options,
  query,
  onQueryChange,
  findOptions,
  describeOption,
  ariaLabel,
  placeholder,
  clearLabel = `清除${ariaLabel}`,
  suggestionsLabel = `${ariaLabel}建议`,
}: {
  options: Option[];
  query: string;
  onQueryChange: (value: string) => void;
  findOptions: (query: string) => Option[];
  describeOption: (option: Option) => string;
  ariaLabel: string;
  placeholder: string;
  clearLabel?: string;
  suggestionsLabel?: string;
}) {
  const [inputValue, setInputValue] = useState(query);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const composing = useRef(false);
  useEffect(() => {
    if (!composing.current) setInputValue(query);
  }, [query]);
  function changeInput(value: string) {
    // Update the input synchronously; route updates must never interrupt IME composition.
    setInputValue(value);
    if (!composing.current) {
      onQueryChange(value);
      setSuggestionsOpen(Boolean(value.trim()));
    }
  }
  function clearSearch() {
    composing.current = false;
    setSuggestionsOpen(false);
    setInputValue("");
    onQueryChange("");
  }
  return (
    <Autocomplete<Option, false, false, true>
      freeSolo
      fullWidth
      value={null}
      inputValue={inputValue}
      open={suggestionsOpen && Boolean(inputValue.trim())}
      openOnFocus
      clearOnBlur={false}
      autoHighlight
      options={options}
      getOptionLabel={(item) => (typeof item === "string" ? item : item.label)}
      getOptionKey={(item) => (typeof item === "string" ? item : item.key)}
      filterOptions={(_, state) => findOptions(state.inputValue).slice(0, 6)}
      onOpen={() => {
        if (!composing.current && inputValue.trim()) setSuggestionsOpen(true);
      }}
      onClose={() => setSuggestionsOpen(false)}
      onInputChange={(_, value, reason) => {
        if (reason === "input") changeInput(value);
        else if (reason === "clear") clearSearch();
      }}
      onChange={(_, item) => {
        if (item !== null) changeInput(typeof item === "string" ? item : item.label);
        setSuggestionsOpen(false);
      }}
      clearText={clearLabel}
      slotProps={{
        listbox: { "aria-label": suggestionsLabel, sx: { maxHeight: 320 } },
        paper: { variant: "outlined", sx: { mt: 0.75, borderRadius: 2 } },
      }}
      renderOption={({ key, ...props }, item) => (
        <Box component="li" key={key} {...props}>
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {item.label}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
              {describeOption(item)}
            </Typography>
          </Stack>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={placeholder}
          slotProps={{
            ...params.slotProps,
            htmlInput: {
              ...params.slotProps.htmlInput,
              "aria-label": ariaLabel,
              onCompositionStart: () => {
                composing.current = true;
                setSuggestionsOpen(false);
              },
              onCompositionEnd: (event: CompositionEvent<HTMLInputElement>) => {
                composing.current = false;
                changeInput(event.currentTarget.value);
              },
            },
            input: {
              ...params.slotProps.input,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlined />
                </InputAdornment>
              ),
            },
          }}
          sx={{ "& .MuiOutlinedInput-root": { bgcolor: "background.paper", borderRadius: 3 } }}
        />
      )}
    />
  );
}
