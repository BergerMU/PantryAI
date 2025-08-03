'use client'
import { useState, useEffect } from 'react'
import { firestore } from '@/firebase'
import { Box, Button, Modal, Stack, ThemeProvider, TextField, createTheme, Typography } from '@mui/material'
import { collection, doc, updateDoc, deleteDoc, getDoc, getDocs, query, setDoc } from 'firebase/firestore'
import { GoogleGenerativeAI } from "@google/generative-ai"
import ReactMarkdown from 'react-markdown'

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_AI_API)
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

export default function Home() {
  //Initializing variables
  const [Inventory, setInventory] = useState([])
  const [itemName, setItemName] = useState('')
  const [itemQuantity, setItemQuantity] = useState('')
  const [itemMeasurement, setItemMeasurement] = useState('')
  const [mealDescription, setMealDescription] = useState('')
  const [change, setChange] = useState({})
  const [recipes, setRecipes] = useState([])
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [isEditMode, setIsEditMode] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)

  //Helper update inventory function
  const updateInventory = async () => {

    //Gets the items in the from the database and puts each item into a list
    const snapshot = query(collection(firestore, 'Inventory'))
    const docs = await getDocs(snapshot)
    const InventoryList = []
    docs.forEach((doc) => {
      InventoryList.push({
        id: doc.id,
        ...doc.data(),
      })
    })
    setInventory(InventoryList)
  }

  // Creates filtered inventory that's used when the user is searching for an item
  const filteredInventory = Inventory.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()))

  // Generates recipes
  const generateRecipes = async () => {
    // Creates string of the inventory that the AI can easily understand
    const pantryString = Inventory.map(({ name, quantity, measurement }) => `${name} ${quantity} ${measurement}`).join(', ')

    //Detailed prompt along with the items we have in our inventory, along with the type of meal we want to make.
    const prompt = `Here's a list of items I have in my pantry: ${pantryString}.
        Here are a couple of rules I need you to follow exactly.
        1. Here is how I want you to generate these meals
        1.1 suggest 3 different recipes based off of the ingredients in the pantry that are most
          similar to a ${mealDescription} type of meal.
        1.2 If the pantry has less than 4 unique items in it ensure that the recipe doesn't
          have ingredients that aren't in the pantry.
        1.3 If the pantry has 4 or more unique items in it then the recipes you provide are
          allowed to have some items that aren't in the pantry.
        1.4 If the recipe you generate has less than 5 items ensure that it uses items only found
          in the pantry, otherwise you must have at least 80% similar ingredients.
        1.5 Ensure that there are at least 80% similar ingredients, otherwise look for another recipe.
        1.6 Ensure that every recipe you generate is based off of an actual common recipe that someone
          would make in real life.
        1.7 Default to make the portion sizes for each meal 1-2 people unless otherwise described
          in the meal description.
        2.Here is my exact formatting I want you to fololow.
        2.1 I want everything to be left aligned 
        2.2 H2 title that has the name of the dish only
        2.3 regular text with a description of the dish
        2.4 H3 text saying "Ingredients"
        2.5 bullet point list of ingrediants with the appropriate measurements
        2.6 H3 text saying "Steps"
        2.7 bullet point list of detailed steps to inform the person how to make the dish
        3. Separate each recipe with a clear divider "---" to make them distinct.
        4. If you see anything you don't reconize don't put it in the recipe
        5. Ensure you use the right proportions of ingrediants and the right types of measurements
          for each ingredients. If a item doesn't have a certain measurement assigned to it you can
          assume what would be the most common type of measurement for that type and amount of item.
        6. Make sure that the portion of ingrediants are appropiate, you don't have to use all of one item if the recipe doesn't need it.`

    //Error handling
    try {
      const result = await model.generateContent(prompt);
      if (result.response && result.response.text) {
        return result.response.text()
      } else {
        console.error('Error: Unexpected response structure')
        return ''
      }
    } catch (error) {
      console.error('Error generating recipes: ', error)
      return ''
    }
  }

  //Ensures to split up the generated recipe into parts after each "---"
  const handleGenerateRecipes = async () => {
    const result = await generateRecipes(Inventory, mealDescription)
    const recipesArray = result.split("---")
    const uniqueRecipes = recipesArray.filter(recipe => recipe.trim() !== '')
    setRecipes(uniqueRecipes)
  }

  //Saves item in database
  const handleSaveItem = async () => {
    // Error handling
    if (!itemName || !itemQuantity) {
      console.log("Error: Not all fields are filled")
      return
    }

    const quantity = parseInt(itemQuantity, 10)

    if (isNaN(quantity) || quantity < 1) {
      console.log("Error: Quantity must be a number greater than 0")
      return
    }

    //Gathers info from database
    const measurement = itemMeasurement || ''
    const docRef = doc(collection(firestore, "Inventory"), itemName)

    //Allows for user to edit an item already in the database
    if (isEditMode && selectedItem) {
      await updateDoc(docRef, {
        name: itemName,
        quantity: quantity,
        measurement: measurement,
      })
    } else {
      const docSnap = await getDoc(docRef)
      if (docSnap.exists()) {
        const existingItem = docSnap.data()
        const tempQuantity = parseInt(existingItem.quantity, 10)
        const newQuantity = tempQuantity + quantity
        await updateDoc(docRef, {
          quantity: newQuantity,
        })
      } else {
        const newItem = {
          name: itemName,
          quantity: quantity,
          measurement: measurement,
        }
        await setDoc(docRef, newItem)
      }
    }

    //Defaults for item
    setItemName('')
    setItemQuantity('')
    setItemMeasurement('')
    setIsEditMode(false)
    setSelectedItem(null)
    updateInventory()
    handleClose()
  }

  //Update item quantity
  const handleUpdateQuantity = async (itemName, itemChange) => {
    const docRef = doc(collection(firestore, "Inventory"), itemName)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      //Error Handling
      if (!itemChange) {
        console.log("Error: Not all fields are filled")
        return

        //Get the item and change amount and applies it to item
      } else {
        const newChange = parseInt(itemChange, 10)
        const newQuantity = parseInt(docSnap.data().quantity + newChange)

        if (newQuantity <= 0) {
          await deleteDoc(docRef)
        } else {
          await updateDoc(docRef, { quantity: newQuantity })
        }
        await updateInventory()
      }
    }
  }

  //Custom Theme
  const { palette } = createTheme()
  const { augmentColor } = palette
  const theme = createTheme({
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            backgroundColor: "CA054D",
          }
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            backgroundColor: '#DDDDDD',
            borderRadius: "2vh",
            '& .MuiInputBase-input': {
              color: 'black',
            },
            '&::-webkit-scrollbar': {
              display: 'none',
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: 'transparent',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'transparent',
            },
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'transparent',
            },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: 'black',
            '&.Mui-focused': {
              color: '#3b3b3b',
            },
          },
        },
      },
    },
  });

  // Open's edit mode with item values or default values
  const handleOpen = (item = null) => {
    if (item) {
      setIsEditMode(true)
      setSelectedItem(item)
      setItemName(item.name)
      setItemQuantity(item.quantity)
      setItemMeasurement(item.measurement)
    } else {
      setIsEditMode(false)
      setSelectedItem(null)
      setItemName('')
      setItemQuantity('')
      setItemMeasurement('')
    }
    setOpen(true)
  }

  // Closes menu
  const handleClose = () => {
    setOpen(false)
    setItemName('')
    setItemQuantity('')
    setItemMeasurement('')
  }

  useEffect(() => {
    updateInventory()
  }, [])

  //Material UI interface
  return (

    //Custom theme applied
    <ThemeProvider theme={theme}>
      <Box
        width="100vw"
        height="100vh"
        justifyContent="center"
        alignItems="center"
        overflow="auto"
        display="flex"
        bgcolor="#F7EEDE"
        gap={3}
      >
        {/* Pop up box for editing an item */}
        <Modal open={open} onClose={handleClose}>
          <Box
            position="absolute"
            top="50%"
            left="50%"
            width={{xs:"80vw", s:"50vw", md:"30vw"}}
            boxShadow={24}
            bgcolor="#DEC5E3"
            borderRadius={3}
            p={4}
            display="flex"
            flexDirection="column"
            sx={{ transform: 'translate(-50%, -50%)' }}
          >
            {/* Name of item, quantity, and measurement for editing menu */}
            <Stack direction="column" alignItems="center" justifyContent="center" spacing={2}>
              <Typography fontSize="3vh">
                {itemName.charAt(0).toUpperCase() + itemName.slice(1)}
              </Typography>
              <Stack direction="row" justifyContent="center" alignItems="center" spacing={1}>
                <TextField label="Quantity" value={itemQuantity} onChange={(e) => setItemQuantity(e.target.value)} InputProps={{ inputProps: { min: 1 } }} />
                <TextField label="Measurement" value={itemMeasurement} onChange={(e) => setItemMeasurement(e.target.value)} />
              </Stack>
              <Button style={{ backgroundColor: "#CA054D" }} size="large" variant="contained" onClick={handleSaveItem}>
                Save
              </Button>
            </Stack>
          </Box>
        </Modal>

        
        {/* Main page */}
        <Stack direction="column" height="100vh" width="100vw">
          {/*Header Start*/}
          <Stack direction="row" bgcolor="#3B1C32" padding={1} display="flex" justifyContent="space-between" alignItems="center">
            <Box bgcolor="#CA054D" borderRadius={3} padding={2} display="flex" flexDirection="column" justifyContent="center" alignContent="center">
              <Typography color="white" >PantryAI</Typography>
            </Box>
            <Box bgcolor="#CA054D" borderRadius={3} padding={2} display="flex" flexDirection="column" justifyContent="center" alignContent="center">
              <Typography color="white" >Your Digital Pantry</Typography>
            </Box>
          </Stack>
          {/*Header End*/}
          
          {/* Adding items */}
          <Box width="100vw" bgcolor="#A4D4B4" padding={2} display="flex" alignItems="baseline" justifyContent="center">
            <Stack direction="column" alignItems="center" justifyContent="center" spacing={2}>
                <Button style={{ backgroundColor: "#CA054D" }} padding={2} size="large" variant="contained" onClick={() => handleSaveItem()}>
                  Add Item
                </Button>
                <Stack direction="row" spacing={1}>
                  <TextField label="Item Name" value={itemName} onChange={(e) => setItemName(e.target.value)} />
                  <TextField label="Quantity" value={itemQuantity} onChange={(e) => setItemQuantity(e.target.value)} InputProps={{ inputProps: { min: 1 } }} />
                  <TextField label="Measurement" value={itemMeasurement} onChange={(e) => setItemMeasurement(e.target.value)} />
                </Stack>
            </Stack>
          </Box>

          {/* Body Start */}
          <Box height="fit-content" bgcolor="#A4D4B4" padding={2}>
            <Stack direction ={{xs: "column", md: "row"}} alignItems={'center'} spacing={1}>

              {/* Left section */}
              <Stack height="68vh" width={{xs: "90vw", md: "50vw"}} spacing={1} bgcolor="#B96D40" borderRadius={3} overflow="auto" alignItems="center" padding={2}>
                
                {/* List of items in database */}
                <TextField fullWidth label="Search Item" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                {filteredInventory.map(({ id, name, quantity, measurement }) => (
                  <Box
                    key={id}
                    width="95%"
                    minHeight="fit-content"
                    display="flex"
                    alignItems="start"
                    justifyContent="space-between"
                    bgcolor="#DEC5E3"
                    padding={3}
                    borderRadius={3}
                    flexDirection={{xs: 'column', md: "row"}}
                  >

                    {/* Item name, quantity, and measurement */}
                    <Stack direction="column">
                      <Typography variant="h4" textAlign="left" fontSize="3vh">
                        {name.charAt(0).toUpperCase() + name.slice(1)}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Typography variant="h4" textAlign="left" fontSize="3vh">
                          {quantity}
                        </Typography>
                        <Typography variant="h4" textAlign="left" fontSize="3vh">
                          {measurement}
                        </Typography>
                      </Stack>
                    </Stack>

                    {/* Update item, remove, or edit */}
                    <Stack direction={{xs: "column", md: "row"}} spacing={2} alignItems='end'>
                      <Box width={{sm: "100%", md: "7vw"}}>
                        <TextField label="amount"
                          InputProps={{ inputProps: { min: 0 } }} value={change[name] || ''}
                          onChange={(e) => setChange({ ...change, [name]: e.target.value })}>
                        </TextField>
                      </Box>
                      <stack direction='row'>
                        <Button style={{ backgroundColor: "#CA054D" }} variant="contained" onClick={() => handleUpdateQuantity(name, change[name])}>
                          Add
                        </Button>
                        <Button style={{ backgroundColor: "#CA054D" }} variant="contained" onClick={() => handleUpdateQuantity(name, -change[name])}>
                          Remove
                        </Button>
                        <Button style={{ backgroundColor: "#CA054D" }} variant="contained" onClick={() => handleOpen({ name, quantity, measurement })}>
                          Edit
                        </Button>
                      </stack>
                    </Stack>
                  </Box>
                ))}
              </Stack>

              {/* AI response generation */}
              <Stack height="68vh" width={{xs: "90vw", md: "50vw"}} spacing={1} bgcolor="#B96D40" borderRadius={3} overflow="auto" alignItems="center" padding={2}>
                <TextField size='large' variant="outlined"
                  fullWidth
                  label="Describe what type of meal you want"
                  value={mealDescription} onChange={(e) => setMealDescription(e.target.value)} />
                <Button style={{ backgroundColor: "#CA054D" }} variant="contained" onClick={handleGenerateRecipes}>Generate AI Suggested Recipes</Button>
                <Stack spacing={2}>
                  {recipes.map((recipe, index) => (
                    <Box width= {{xs: "70vw", md:"600px"}}
                      padding={3}
                      key={index}
                      overflow="auto"
                      bgcolor="#DEC5E3"
                      alignItems="center"
                      justifyContent="center"
                      display="flex"
                      borderRadius={3}
                    >
                      <Typography component="div">
                        <ReactMarkdown>{recipe}</ReactMarkdown>
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Stack>
            </Stack>
          </Box>
        </Stack>
      </Box>
    </ThemeProvider>
  )
}
